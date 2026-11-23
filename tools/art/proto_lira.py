# 리라 합성 시제품: 몸(무기 없음) + 딱딱한 낫(손에 붙여 회전) + 코드 사슬(몸에 감김 → 등불)
import math, numpy as np
from PIL import Image
T='art/lira2/'
body=Image.open(T+'body-idle.png').convert('RGBA'); scy=Image.open(T+'scythe.png').convert('RGBA')
HAND=(80,52)                       # 몸 그림에서 주먹 자리
STAFF_TOP=(69,30); STAFF_BOT=(54,95)   # 낫 그림에서 자루 위·아래
GRIP_T=0.35                        # 자루 위에서 이 비율 지점을 쥠
PAL={'ink':(14,12,16,255),'ch1':(58,56,64,255),'ch2':(118,116,126,255),'brass':(150,104,48,255),'brass2':(212,160,80,255),'fl':(255,150,40,255),'fl2':(255,230,140,255)}
def lerp(a,b,t): return (a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t)
GRIP=lerp(STAFF_TOP,STAFF_BOT,GRIP_T)
def rot_sprite(img, ang, piv):    # 픽셀 그대로 회전 (가장 가까운 칸)
  a=np.asarray(img); h,w=a.shape[:2]; c,s=math.cos(ang),math.sin(ang)
  R=int(math.hypot(w,h))+2; out=np.zeros((R*2,R*2,4),np.uint8)
  for y in range(R*2):
    for x in range(R*2):
      dx,dy=x-R,y-R; sx=c*dx+s*dy+piv[0]; sy=-s*dx+c*dy+piv[1]
      ix,iy=int(round(sx)),int(round(sy))
      if 0<=ix<w and 0<=iy<h and a[iy,ix,3]: out[y,x]=a[iy,ix]
  return Image.fromarray(out), (R,R)
def put(c,x,y,col):
  x,y=int(round(x)),int(round(y))
  if 0<=x<c.width and 0<=y<c.height: c.putpixel((x,y),col)
def chain_line(c,p0,p1,front=True,phase=0):   # 사슬 고리: 가로 고리(2칸)·세로 고리(2칸)를 번갈아 → 굵은 픽셀 사슬
  L=math.hypot(p1[0]-p0[0],p1[1]-p0[1]); n=max(1,int(L/2)); ux,uy=(p1[0]-p0[0])/(L or 1),(p1[1]-p0[1])/(L or 1); nx,ny=-uy,ux
  for i in range(n+1):
    x,y=lerp(p0,p1,i/n)
    if (i+phase)%2==0: put(c,x,y,PAL['ch2']); put(c,x+ux,y+uy,PAL['ch1'])
    else: put(c,x+nx*0.6,y+ny*0.6,PAL['ink']); put(c,x-nx*0.6,y-ny*0.6,PAL['ch1'])
M=Image.open(T+'master-final.png').convert('RGBA'); LAN=M.crop((76,89,89,102))
def lantern(c,x,y,t):
  c.alpha_composite(LAN,(int(x)-6,int(y)-7)); return
def _old_lantern(c,x,y,t):
  x,y=int(x),int(y)
  for dx in range(-2,3): put(c,x+dx,y-4,PAL['brass'])
  for dy in range(-3,3):
    put(c,x-3,y+dy,PAL['ink']); put(c,x+3,y+dy,PAL['ink'])
    for dx in range(-2,3): put(c,x+dx,y+dy,PAL['brass2'] if abs(dx)==2 else (PAL['fl2'] if dy>=0 and abs(dx)<=1 and (t//4+dx)%3 else PAL['fl']))
  for dx in range(-3,4): put(c,x+dx,y+3,PAL['ink'])
  put(c,x,y-5,PAL['ink'])
def frame(ang, loops, lan, t, wx=56, wy=66):
  W,H=200,130; c=Image.new('RGBA',(W,H),(60,58,70,255)); ox,oy=20,10
  # 몸 뒤쪽 사슬 (감긴 고리의 뒤 반쪽)
  back=Image.new('RGBA',(W,H),(0,0,0,0)); front=Image.new('RGBA',(W,H),(0,0,0,0))
  rx,ry=11,3
  for L in range(int(math.ceil(loops))):
    frac=min(1,loops-L); yy=oy+wy+L*3
    for i in range(int(48*frac)):
      th=i/48*2*math.pi; x=ox+wx+rx*math.cos(th); y=yy+ry*math.sin(th)
      put(front if math.sin(th)>0 else back,x,y,PAL['ch2'] if i%3==0 else PAL['ch1'] if i%3==1 else PAL['ink'])
  c.alpha_composite(back)
  c.alpha_composite(body,(ox,oy))
  # 낫: 쥔 점을 손에 붙이고 회전
  sp,pc=rot_sprite(scy,ang,GRIP); c.alpha_composite(sp,(int(ox+HAND[0]-pc[0]),int(oy+HAND[1]-pc[1])))
  c.alpha_composite(front)
  # 자루 끝 → 허리 감김 시작점
  ca,sa=math.cos(ang),math.sin(ang)
  bx=STAFF_BOT[0]-GRIP[0]; by=STAFF_BOT[1]-GRIP[1]; butt=(ox+HAND[0]+ca*bx-sa*by, oy+HAND[1]+sa*bx+ca*by)
  wrap0=(ox+wx+rx, oy+wy)
  chain_line(c,butt,wrap0,phase=t)
  # 감김 끝 → 등불
  last=(ox+wx-rx*0.2, oy+wy+max(0,math.ceil(loops)-1)*3+ry)
  chain_line(c,last,(ox+lan[0],oy+lan[1]-5),phase=t)
  lantern(c,ox+lan[0],oy+lan[1],t)
  return c
frames=[]
# 서기: 등불이 허리 옆에서 흔들림
for t in range(12): frames.append(frame(0.0,2.5,(64+2*math.sin(t/12*2*math.pi),86),t))
# 던지기: 감긴 사슬이 풀리며 등불이 앞으로 날아감
for t in range(14):
  k=(t+1)/14; frames.append(frame(-0.15*math.sin(k*math.pi),2.5*(1-k),(64+110*k, 86-30*math.sin(k*math.pi)),t))
for t in range(6): frames.append(frame(0.0,0,(174,86),t))
# 회수: 다시 감김
for t in range(12):
  k=(t+1)/12; frames.append(frame(0.12*math.sin(k*math.pi),2.5*k,(174-110*k, 86-18*math.sin(k*math.pi)),t))
big=[f.resize((f.width*3,f.height*3),Image.NEAREST) for f in frames]
big[0].save('proto.gif',save_all=True,append_images=big[1:],duration=70,loop=0)
frames[0].resize((600,390),Image.NEAREST).save('proto0.png'); frames[20].resize((600,390),Image.NEAREST).save('proto20.png')
