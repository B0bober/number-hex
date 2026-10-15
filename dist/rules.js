import { key, DIRECTIONS } from './classic-engine.js';
export const isDigit = n => Number.isInteger(n) && n >= 0 && n <= 9;
export const sideValid = values => values.length === 4 && values.every(isDigit) && values[0] === values[3] && (values[1] + values[2]) % 10 === values[0];
export const SHAPES = [
  { name: 'Up', corners: [[1,-2],[1,1],[-2,1]], sides: [[[1,-2],[1,-1],[1,0],[1,1]],[[1,1],[0,1],[-1,1],[-2,1]],[[-2,1],[-1,0],[0,-1],[1,-2]]] },
  { name: 'Down', corners: [[-1,-1],[2,-1],[-1,2]], sides: [[[-1,-1],[0,-1],[1,-1],[2,-1]],[[2,-1],[1,0],[0,1],[-1,2]],[[-1,2],[-1,1],[-1,0],[-1,-1]]] },
].map(shape => ({ ...shape, boundary: [...new Map(shape.sides.flat().map(p => [p.join(','), p])).values()] }));
const point = (q, r, offset) => ({ q: q + offset[0], r: r + offset[1] });
export const boardMap = tiles => new Map(tiles.map(t => [key(t.q, t.r), t]));
function triangleInfo(map, q, r, orientation) {
  const shape = SHAPES[orientation], corners = shape.corners.map(p => point(q,r,p)), sides = shape.sides.map(side => side.map(p => point(q,r,p)));
  const boundary = shape.boundary.map(p => point(q,r,p));
  const get = p => map.get(key(p.q,p.r));
  const cornerTiles = corners.map(get).filter(Boolean);
  const pairs = sides.filter(side => get(side[1]) && get(side[2]));
  const fullSides = sides.filter(side => side.every(get));
  // Begin tracking once a side is built, all three side pairs are present,
  // or all three corners exist. The six initial neighbors activate both stars.
  const active = fullSides.length > 0 || pairs.length === 3 || cornerTiles.length === 3;
  if (!active) return null;
  const requirements = [...cornerTiles.map(t => t.value), ...pairs.map(side => (get(side[1]).value + get(side[2]).value) % 10)];
  const values = new Set(requirements);
  return { id: `${q},${r}:${orientation}`, q, r, orientation, name: shape.name, corners, sides, boundary, valid: values.size <= 1, requiredDigit: values.size === 1 ? requirements[0] : null, cornersFilled: cornerTiles.length, occupied: boundary.filter(get).length, fullSides: fullSides.length, complete: boundary.every(get) };
}
function touchingTriangles(map, q, r) {
  const result = [];
  for (let orientation = 0; orientation < SHAPES.length; orientation++) {
    for (const [dq,dr] of SHAPES[orientation].boundary) {
      const info = triangleInfo(map,q-dq,r-dr,orientation);
      if (info) result.push(info);
    }
  }
  return result;
}
export function largeTriangles(tiles) {
  const map = boardMap(tiles), centers = new Map();
  for (const tile of tiles) for (let o=0;o<2;o++) for (const [dq,dr] of SHAPES[o].boundary) {
    const q = tile.q-dq, r = tile.r-dr; centers.set(`${q},${r}:${o}`,{q,r,o});
  }
  return [...centers.values()].map(({q,r,o})=>triangleInfo(map,q,r,o)).filter(Boolean);
}
function axisKey(dq,dr) { if(dq<0||(dq===0&&dr<0)){dq=-dq;dr=-dr;} return `${dq},${dr}`; }
function requirementsAt(map,q,r) {
  const result = [], interiorAxes=new Set();
  for (const triangle of touchingTriangles(map,q,r)) {
    if (!triangle.valid || triangle.requiredDigit === null) continue;
    if (triangle.corners.some(p=>p.q===q&&p.r===r)) result.push({digit:triangle.requiredDigit,triangle,kind:'corner'});
    for (const side of triangle.sides) for(const i of [1,2]) {
      if(side[i].q!==q||side[i].r!==r) continue;
      const other=map.get(key(side[3-i].q,side[3-i].r));
      if(other) {result.push({digit:(triangle.requiredDigit-other.value+10)%10,triangle,kind:'interior'});interiorAxes.add(axisKey((side[3].q-side[0].q)/3,(side[3].r-side[0].r)/3));}
    }
  }
  // Fill gaps from the side equation. The corner is an endpoint, so it must
  // not be reused as an interior predecessor in the reverse direction.
  for (const [dq,dr] of DIRECTIONS.slice(0,3)) for(const i of [1,2]) {
    const side=Array.from({length:4},(_,j)=>({q:q+(j-i)*dq,r:r+(j-i)*dr}));
    const a=map.get(key(side[0].q,side[0].r)),b=map.get(key(side[3].q,side[3].r)),other=map.get(key(side[3-i].q,side[3-i].r));
    if(a&&b&&other&&a.value===b.value) {result.push({digit:(a.value-other.value+10)%10,kind:'interior'});interiorAxes.add(axisKey(dq,dr));}
  }
  // Otherwise extend two consecutive numbers by one hex in any direction.
  for (const [dq,dr] of DIRECTIONS) {
    if(interiorAxes.has(axisKey(dq,dr)))continue;
    const a=map.get(key(q-2*dq,r-2*dr)),b=map.get(key(q-dq,r-dr));
    if(a&&b) result.push({ digit:(a.value+b.value)%10, pair:[a,b], kind:'sum' });
  }
  return result;
}
function explanation(requirements,digit) {
  const sum = requirements.find(p=>p.kind==='sum');
  if(sum) { const [a,b]=sum.pair.map(t=>t.value); return `${a} + ${b} = ${a+b}${a+b>9?` → ${digit}`:''}. Place ${digit} in the gold hex.`; }
  return `The outlined triangle requires ${digit} here. Its corners must match and each side must add up.`;
}
export function checkWithMap(map,q,r,digit) {
  if(!Number.isSafeInteger(q)||!Number.isSafeInteger(r)||!isDigit(digit)) return {ok:false,reason:'Choose a digit from your hand.'};
  if(map.has(key(q,r))) return {ok:false,reason:'That hex is already occupied.'};
  if(!DIRECTIONS.some(([dq,dr])=>map.has(key(q+dq,r+dr)))) return {ok:false,reason:'Build next to the existing board.'};
  const requirements=requirementsAt(map,q,r);
  if(!requirements.length) return {ok:false,reason:'Extend two numbers in a straight line, or fill a side of an outlined triangle.'};
  if(requirements.some(p=>p.digit!==digit)) return {ok:false,reason:'That digit conflicts with a side or a matching corner. Check the larger triangles.'};
  map.set(key(q,r),{q,r,value:digit});
  const triangles=touchingTriangles(map,q,r),conflicts=triangles.filter(t=>!t.valid);
  const seen=new Set(),completedSides=[];
  for(const t of triangles) for(const side of t.sides) {
    if(!side.some(p=>p.q===q&&p.r===r)||!side.every(p=>map.has(key(p.q,p.r)))) continue;
    const id=side.map(p=>key(p.q,p.r)).sort().join(';');
    if(!seen.has(id)){seen.add(id);completedSides.push(side.map(p=>map.get(key(p.q,p.r)).value));}
  }
  map.delete(key(q,r));
  if(conflicts.length) return {ok:false,conflicts,reason:'This would give a larger triangle conflicting corners or side sums.'};
  return {ok:true,triangles,completedSides,explanation:explanation(requirements,digit)};
}
export function checkPlacement(tiles,q,r,digit){return checkWithMap(boardMap(tiles),q,r,digit);}
export function frontier(tiles) {
  const map=boardMap(tiles),candidates=new Map(),result=[];
  for(const t of tiles) for(const[dq,dr]of DIRECTIONS){const q=t.q+dq,r=t.r+dr;if(!map.has(key(q,r)))candidates.set(key(q,r),{q,r});}
  for(const target of candidates.values()) {
    const requirements=requirementsAt(map,target.q,target.r);
    if(!requirements.length)continue;
    const digit=requirements[0].digit;
    if(requirements.some(p=>p.digit!==digit))continue;
    const check=checkWithMap(map,target.q,target.r,digit);
    if(check.ok) result.push({...target,validDigits:[digit],triangles:check.triangles,explanation:check.explanation,completedSides:check.completedSides});
  }
  return result;
}
export function generateRing(center,random=Math.random) {
  if(!isDigit(center))throw new Error('Choose a center digit from 0 to 9.');
  // Alternation is required by equal corners. Among the extensible patterns,
  // prefer the largest number of distinct digits across center and ring.
  const patterns=[0,5].map(a=>({a,b:(a+center)%10}));
  const variety=p=>new Set([center,p.a,p.b]).size;
  const maximum=Math.max(...patterns.map(variety));
  const best=patterns.filter(p=>variety(p)===maximum);
  let {a,b}=best[Math.floor(random()*best.length)];
  if(random()<.5)[a,b]=[b,a];
  return Array.from({length:6},(_,i)=>i%2?b:a);
}
