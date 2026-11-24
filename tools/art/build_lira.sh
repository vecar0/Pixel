#!/bin/bash
# Rebuild every Lira move (body GIFs in art/lira2/v15/raw + rigid scythe) into OUT at game scale.
# usage: tools/art/build_lira.sh [OUT=art/lira2/v16] [SCALE=0.82]
set -e
cd "$(dirname "$0")/../../art/lira2"
OUT=${1:-v16}; export SCALE=${2:-0.82}
export LANTERN=lantern-v12.png,lantern-v12.json CLAMP=4
G='{"upper":[76.9,68.3],"lower":[72.7,84.4]}'; A="body-v12.png scythe-v12-nolan.png"
RC=../../tools/art/reap_comp.py; EC=../../tools/art/exec_comp.py
mkdir -p $OUT
(export SLIDE=0,0,0,8,8,6,3,0
 OVR=0,-15,-15,0,0,25,10,0 python3 $RC $A "$G" v15/raw/reap.gif $OUT/reap 0,-75,-95,20,95,150,135,130 r,a,a,S,s,f,h,h
 OVR=0,10,10,0,0,-22,-8,0 python3 $RC $A "$G" v15/raw/pull.gif $OUT/pull 0,95,110,60,25,-5,6,10 r,a,a,S,s,f,h,h
 OVR=0,-10,-10,0,0,20,8,0 python3 $RC $A "$G" v15/raw/rise.gif $OUT/rise 0,-110,-120,-70,-25,8,-6,-10 r,a,a,S,s,f,h,h
 OVR=0,-10,-10,0,0,20,8,0 python3 $RC $A "$G" v15/raw/rise.gif $OUT/rise_follow 0,-125,-125,-80,-25,8,-6,-10 r,a,a,S,s,f,h,h)
python3 $RC $A "$G" v15/raw/idle.gif $OUT/idle 0,0,0,0,0,0 l,l,l,l,l,l
BEHIND=1 ONEFIST=1 python3 $RC $A "$G" v15/raw/run.gif $OUT/run -60,-60,-60,-60,-60,-60,-60,-60 n,n,n,n,n,n,n,n
python3 $RC $A "$G" v15/raw/jump.gif $OUT/jump 0,0,-10,-20,-20,-10,0,0 j,j,j,j,j,j,j,j
python3 $RC $A "$G" v15/raw/hurt.gif $OUT/hurt 0,-25,-30,-15,-5,0 r,r,r,r,r,r
python3 $RC $A "$G" v15/raw/death.gif $OUT/death 0,10,0,0,0,0,0,0 r,r,d,d,d,d,d,d
python3 $RC $A "$G" v15/raw/block.gif $OUT/block 0,0,0,0,0,0 r,j,h,h,h,h
ONEFIST=1 THROW=-1,-1,0,0.15,0.45,0.75,1,1 python3 $RC $A "$G" v15/raw/throw.gif $OUT/throw 0,5,10,10,10,10,10,10 r,a,T,T,T,T,h,h
PLAN=plans/plan_twirl.json python3 $EC $A "$G" v15/raw/twirl.gif $OUT/twirl
PLAN=plans/plan_toss.json python3 $EC $A "$G" v15/raw/tosscatch.gif $OUT/tosscatch
python3 $EC $A "$G" v15/raw/exec.gif $OUT/exec
# chained pieces for the game (no forward impulse: the engine moves her)
export NOIMP=1
python3 ../../tools/art/combo.py $OUT/c_atk2 '[["move","'$OUT'/reap",7,7],["auto"],["move","'$OUT'/pull",1,7]]'
python3 ../../tools/art/combo.py $OUT/c_atk3 '[["move","'$OUT'/pull",7,7],["auto"],["move","'$OUT'/rise",1,7]]'
python3 ../../tools/art/combo.py $OUT/c_follow '[["move","'$OUT'/exec",15,15],["bridge",2,"B"],["circle","'$OUT'/rise_follow",[2,3,4,5,6],0,-20,"B"],["move","'$OUT'/rise_follow",6,7]]'
echo built $OUT
