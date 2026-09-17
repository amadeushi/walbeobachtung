"""Extract literal data arrays only; never execute the remote archive JavaScript."""
import re,json,ast,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1]
p=root/'lib/data/stadtrat-2016-source.js.txt'; raw=p.read_text()
def arr(name):
 m=re.search(r'\b'+re.escape(name)+r'\s*=\s*new Array\((.*?)\);',raw,re.S)
 if not m: raise ValueError(name)
 return ast.literal_eval('['+m.group(1)+']')
names=arr('pnamen')[:8]; districts=arr('beznamen'); values=arr('erg');invalid=arr('ungsz');groups=arr('wbpos')
assert len(districts)==114 and len(values)==114*10+1 and values[-1]==0
rows=[]
for i,name in enumerate(districts):
 v=values[i*10:(i+1)*10]
 r={'gebiet-name':name,'gebiet-nr':re.search(r'\(([^)]+)\)$',name)[1],'A':str(v[9]),'B':str(v[8]),'C1':str(invalid[i]),'C2':str(v[8]-invalid[i]),'D':str(sum(v[:8])),'max-schnellmeldungen':'1','anz-schnellmeldungen':'1','wahlbereich':str(groups[i])}
 r.update({f'D{j+1}':str(v[j]) for j in range(8)})
 assert sum(v[:8])<=3*(v[8]-invalid[i])
 rows.append(r)
keys=['A','B','C1','C2','D','max-schnellmeldungen','anz-schnellmeldungen']+[f'D{i+1}' for i in range(8)]
total={k:str(sum(int(r[k]) for r in rows)) for k in keys};total['gebiet-name']='Stadt Hildesheim'
# Independent totals in the archive's elected-candidate summary.
for entry in arr('gewaehlte'):
 parts=entry.split(';')
 if parts[0]=='6': assert int(total[f'D{names.index(parts[3])+1}'])==int(parts[2])
assert round(int(total['B'])/int(total['A'])*100,1)==49.2
out={'year':'2016','wahl':'Stadtratswahl','metadata':{'csvs':[],'dateifelder':[{'name':'Stadtratswahl','parteien':[{'feld':f'D{i+1}','wert':n} for i,n in enumerate(names)]}]},'rows':rows,'total':total,'level':'Wahlbezirke (Gebietsstand 2016)','sources':['http://wahlen.rathaus-hildesheim.de/gw2016stadtrat_hildesheim.html','http://wahlen.rathaus-hildesheim.de/gw2016stadtrat_hildesheim.js?v=170125110929'],'retrieved':'08.09.2026','archived':True,'resultStatus':'Endergebnis vom 19.09.2016, 09:09 Uhr','absentParties':['Die PARTEI'],'splitAvailable':False,'comparison':{'scope':'Stadt Hildesheim','subareas':'unverified','note':'2016: 114 Wahlbezirke. Einzelne Bezirke sind ohne geprüfte Grenz- und Briefwahlzuordnung nicht direkt mit 2021/2026 vergleichbar.'},'sourceSHA256':hashlib.sha256(p.read_bytes()).hexdigest()}
(root/'lib/data/archive-2016.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
print('2016 validiert:',total)
