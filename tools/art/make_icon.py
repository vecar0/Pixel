# 앱 아이콘: art/lira2/master-v12.png 원화 + 등불 빛 배경 + 테두리. 실행: cd art/lira2 && python3 ../../tools/art/make_icon.py
import numpy as np; from PIL import Image, ImageDraw
src=Image.open('master-v12.png').convert('RGBA')
N=122; X0,Y0=-9,9; LX,LY=82,121          # 크롭 원점, 등불 위치 (원화 좌표)
spr=Image.new('RGBA',(N,N)); spr.alpha_composite(src,(-X0,-Y0))
a=np.array(spr); lx,ly=LX-X0,LY-Y0
yy,xx=np.mgrid[:N,:N]; d=np.hypot(xx-lx,yy-ly)/N
g=np.clip(1-d*1.35,0,1)**1.8
base=np.array([13,10,19]); warm=np.array([150,78,28])
col=base+(warm-base)*g[...,None]; col=np.round(col/14)*14
bg=np.zeros((N,N,4),np.uint8); bg[...,:3]=np.clip(col,0,255); bg[...,3]=255
al=a[...,3]>0; rim=np.zeros_like(al)
for dy,dx in [(-1,0),(1,0),(0,-1),(0,1)]: rim|=np.roll(np.roll(al,dy,0),dx,1)
rim&=~al; bg[rim,:3]=[7,5,11]
art=Image.fromarray(bg); art.alpha_composite(spr)
P='/home/user/Pixel/'
def framed(S=512,B=12):
    k=(S-2*B)//N; c=Image.new('RGBA',(S,S),(13,10,19,255)); off=(S-N*k)//2
    c.paste(art.resize((N*k,N*k),Image.NEAREST),(off,off)); d=ImageDraw.Draw(c)
    for i,colr in enumerate([(40,26,16),(150,100,52),(92,60,30)]):
        t=B//3; d.rectangle([i*t,i*t,S-1-i*t,S-1-i*t],outline=colr,width=t)
    return c
f=framed(); f.save(P+'icon-512.png'); f.save(P+'icon.png'); f.resize((192,192),Image.LANCZOS).save(P+'icon-192.png')
m=Image.new('RGBA',(512,512),(13,10,19,255)); k=3; m.paste(art.resize((N*k,N*k),Image.NEAREST),((512-N*k)//2,(512-N*k)//2)); m.save(P+'icon-maskable-512.png')
