# GIF 동작 → 원본과 같은 픽셀 격자·팔레트로 보정. usage: snap.py in.gif outprefix
import sys, numpy as np
from PIL import Image, ImageSequence
import os; S=os.path.join(os.path.dirname(__file__), '../../art/lira2/') ; MASTER='master-final.png'
M=np.asarray(Image.open(S+MASTER)); mm=M[...,3]>0
PAL=np.unique(M[mm][:,:3].reshape(-1,3),axis=0).astype(float)
# 원본 캐릭터 키(픽셀) — 낫 제외하고 머리~발: 몸통 열 기준 대략
src=sys.argv[1]; out=sys.argv[2]
fr=[np.asarray(f.convert('RGB')).astype(float) for f in ImageSequence.Iterator(Image.open(src))]
H,W,_=fr[0].shape
bg=np.median(np.concatenate([fr[0][0],fr[0][-1],fr[0][:,0],fr[0][:,-1]]),axis=0)
def grid(a):
  gx=np.abs(np.diff(a,axis=1)).sum(2).sum(0)
  best=None
  for s in np.arange(float(os.environ.get('SMIN',2.5)),float(os.environ.get('SMAX',6)),0.02):
    for ph in np.arange(0,s,0.25):
      i=np.round(np.arange(ph,len(gx)-1,s)).astype(int); v=gx[i].mean()
      if best is None or v>best[0]: best=(v,s,ph)
  return best[1],best[2]
s,ph=grid(fr[0]); print('grid',s,ph)
# 몸 높이 맞춤: 원본 몸 높이 / 이 GIF 몸 높이
def hgt(m): r=np.where(m.any(1))[0]; return r[-1]-r[0]+1
res=[]
for a in fr:
  nx=int((W-ph)/s); ny=int((H-ph)/s); o=np.zeros((ny,nx,3))
  for j in range(ny):
    for i in range(nx):
      x0=ph+i*s; y0=ph+j*s; c=a[int(y0+s*0.3):int(y0+s*0.7)+1,int(x0+s*0.3):int(x0+s*0.7)+1].reshape(-1,3); o[j,i]=np.median(c,axis=0)
  from scipy.ndimage import label
  cand=np.abs(o-bg).sum(2)<=45                          # 배경과 비슷한 칸
  lab,_=label(cand); edge_ids=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
  m=~np.isin(lab,list(edge_ids))                        # 가장자리와 이어진 것만 배경 (얼굴 피부는 남김)
  near=np.abs(o-bg).sum(2)<=24; l2,n2=label(near)          # 갇힌 배경 (낫 곡선 안쪽 등): 배경색과 거의 같은 덩어리
  for k in range(1,n2+1):
    if (l2==k).sum()>=3: m[l2==k]=False
  for _ in range(2):                                   # 가장자리 배경 번짐(밝은 회색) 벗겨내기
    e=m&~(np.roll(m,1,0)&np.roll(m,-1,0)&np.roll(m,1,1)&np.roll(m,-1,1))
    m&=~(e&(np.abs(o-bg).sum(2)<110))
  d=((o[:,:,None,:]-PAL[None,None])**2).sum(3); q=PAL[d.argmin(2)]
  rgba=np.zeros((ny,nx,4),np.uint8); rgba[...,:3]=q; rgba[...,3]=m*255
  res.append(rgba)
for k,r in enumerate(res): Image.fromarray(r,'RGBA').save(f'{out}-{k}.png')
print(len(res), res[0].shape)
