import json, statistics as S
st=json.load(open('/tmp/catalog/stats.json')); P=st['pieces']; BS=json.load(open('/tmp/catalog/buildsize.json'))
show=json.load(open('/tmp/catalog/showcase-counts.json')); SD=json.load(open('/tmp/catalog/showcase-designs.json'))
cat=lambda b: b['cat'].replace(' Build','').lower().replace(' ','-')
REF={'building','starter-home','longhouse','tavern','advanced-base','castle','temple','tower','village','interior-design','blacksmith','storage','portal-hub','tree-house'}
ref=[i for i,b in enumerate(BS) if cat(b) in REF and (b['floorA'] or 0)>=40]
refset=set(ref)
def q(a,f):
    if not a: return None
    a=sorted(a); return a[min(len(a)-1,int(f*(len(a)-1)+0.5))]
GROUPS={
 'wall torch (piece_walltorch)':['piece_walltorch'],
 'all torches and lanterns':None,  # kind light, filled below
 'resin candles':['Candle_resin'],
 'drapes and cloth hangings':['piece_cloth_hanging_door','piece_cloth_hanging_door_blue','piece_cloth_hanging_door_blue2','cloth_hanging_long','cloth_hanging_door','cloth_hanging_door_double','dvergrprops_curtain'],
 'banners':['piece_banner%02d'%i for i in range(1,12)],
 'sitting logs (piece_logbench01)':['piece_logbench01'],
 'chests and barrels':['piece_chest','piece_chest_wood','piece_chest_blackmetal','piece_chest_barrel','piece_chest_private','piece_chest_treasure','piece_chest_warderobe','dvergrprops_crate','dvergrprops_crate_long','dvergrprops_barrel'],
 'wood_ledge':['wood_ledge'],
 'pots':['piece_pot1','piece_pot2','piece_pot3','piece_pot1_cracked','piece_pot2_cracked','piece_pot3_cracked','piece_pot1_red','piece_pot2_red','piece_pot3_red'],
 'item stands':['itemstand','itemstandh'],
 'rugs':['rug_deer','rug_fur','rug_wolf','rug_hare','rug_straw','rug_Bjorn','rug_asksvin','rug_seal','rug_moose','jute_carpet','jute_carpet_blue'],
 'seats (all)':None,'tables (all)':None,'beds (all)':None,
}
cat_pieces=json.load(open('/tmp/catalog/pieces.json'))['pieces']
GROUPS['all torches and lanterns']=[n for n,r in cat_pieces.items() if r['kind']=='light']
GROUPS['seats (all)']=[n for n,r in cat_pieces.items() if r['kind']=='seat']
GROUPS['tables (all)']=[n for n,r in cat_pieces.items() if r['kind']=='table']
GROUPS['beds (all)']=[n for n,r in cat_pieces.items() if r['kind']=='bed']
def corpus_counts(names):
    c={}
    for n in names:
        for k,w,bi in (P.get(n,{}).get('per') or []):
            if bi in refset: c[bi]=c.get(bi,0)+k
    return c
def show_counts(names):
    c=[0]*len(SD)
    for n in names:
        for i,k in []: pass
    return c
# showcase per design counts need raw; recompute from blueprint counts file
import subprocess
raw=json.load(open('/tmp/catalog/showcase-raw.json'))
rows=[]
for g,names in GROUPS.items():
    cc=corpus_counts(names)
    dens_all=[100*cc.get(i,0)/BS[i]['floorA'] for i in ref]
    used=[i for i in ref if cc.get(i,0)>0]
    dens_used=[100*cc[i]/BS[i]['floorA'] for i in used]
    ks=[cc[i] for i in used]
    sc=[sum(d.get(n,0) for n in names) for d in raw]
    sd=[100*k/max(20,SD[i]['floorA']) for i,k in enumerate(sc)]
    rows.append({'group':g,'corpus_share_using':round(len(used)/len(ref),2),'corpus_count_p50':q(ks,.5),'corpus_count_p90':q(ks,.9),
      'corpus_per100m2_p50_when_used':round(q(dens_used,.5),2) if dens_used else None,'corpus_per100m2_p90_when_used':round(q(dens_used,.9),2) if dens_used else None,
      'corpus_per100m2_mean_all':round(sum(dens_all)/len(dens_all),2),
      'showcase_designs_using':sum(1 for k in sc if k>0),'showcase_count_median':S.median(sc),'showcase_counts':sc,
      'showcase_per100m2_median':round(S.median(sd),2),'showcase_over_p90':sum(1 for i,k in enumerate(sc) if k>0 and dens_used and sd[i]>q(dens_used,.9))})
json.dump({'reference':'corpus builds in categories %s with 40 m2 or more of floor: %d builds'%(sorted(REF),len(ref)),'groups':rows},open('/tmp/catalog/overuse.json','w'),indent=1)
for r in rows: print(r['group'][:30].ljust(30), 'corpus use %.2f p50 %s p90 %s dens p50 %s p90 %s | show %d/16 med %s dens %s over_p90 %d'%(r['corpus_share_using'],r['corpus_count_p50'],r['corpus_count_p90'],r['corpus_per100m2_p50_when_used'],r['corpus_per100m2_p90_when_used'],r['showcase_designs_using'],r['showcase_count_median'],r['showcase_per100m2_median'],r['showcase_over_p90']), r['showcase_counts'])

# presence across designs: the same piece in every build
raw=json.load(open('/tmp/catalog/showcase-raw.json'))
pres=[]
for n in sorted(set(k for d in raw for k in d)):
    r=cat_pieces.get(n)
    if not r or r['kind'] in ('wall','floor','roof','roofTop','roofCorner','gable','beam','pole','stair','door','window'): continue
    ds=sum(1 for d in raw if d.get(n)); tot=sum(d.get(n,0) for d in raw)
    used=[(k,BS[bi]['floorA']) for k,w,bi in (P[n].get('per') or []) if bi in refset]
    cs=len(used)/len(ref)
    pres.append({'id':n,'name':r['name'],'kind':r['kind'],'showcase_designs':ds,'showcase_total':tot,'corpus_share':round(cs,3),
                 'corpus_count_p50':q([u[0] for u in used],.5),'corpus_count_p90':q([u[0] for u in used],.9),'presence_ratio':round((ds/16)/max(cs,0.005),1)})
pres.sort(key=lambda x:-(x['showcase_designs']/16-x['corpus_share']))
# variety: distinct light, seat, rug and storage pieces per build
def variety(kind):
    names=[n for n,r in cat_pieces.items() if r['kind']==kind]
    per={}
    for n in names:
        for k,w,bi in (P[n].get('per') or []):
            if bi in refset: per.setdefault(bi,set()).add(n)
    corp=[len(v) for v in per.values()]
    sh=[len([n for n in names if d.get(n)]) for d in raw]
    sh=[x for x in sh if x>0]
    return {'kind':kind,'corpus_distinct_p50':q(corp,.5),'corpus_distinct_p90':q(corp,.9),'showcase_distinct_median':S.median(sh) if sh else 0}
var=[variety(k) for k in ('light','seat','table','storage','rug','hanging-cloth','display-stand','container-decor')]
doc=json.load(open('/tmp/catalog/overuse.json'))
doc['presence']=pres; doc['variety']=var
doc['showcase_source']='16 showcase designs regenerated with the lab at main b18cf36 (request.make, tries 1, the seeds in GenCommands.cs ShowcaseList); the saved files on Tyler\'s PC were gone (folder empty on 2026-11-12)'
json.dump(doc,open('/tmp/catalog/overuse.json','w'),indent=1)
for v in var: print(v)
