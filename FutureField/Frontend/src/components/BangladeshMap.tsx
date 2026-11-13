import { useState } from 'react';
import { bangladeshLocations, divisions } from '../data/bangladeshLocations';
type Props = {onDistrictChange:(division:string,district:string)=>void};
export default function BangladeshMap({onDistrictChange}:Props){
 const [division,setDivision]=useState(''); const [district,setDistrict]=useState('');
 return <div className="rounded-xl bg-white p-4 shadow-lg border border-gray-200 text-[#09251C]">
  <h2 className="mb-3 text-base font-semibold">Select Your Farm Location</h2>
  <div className="grid grid-cols-2 gap-2">
   <label className="text-xs font-medium">Division<select className="mt-1 w-full rounded-lg border p-2 text-sm bg-white" value={division} onChange={e=>{setDivision(e.target.value);setDistrict('');onDistrictChange(e.target.value,'');}}><option value="">Select division</option>{divisions.map(d=><option key={d}>{d}</option>)}</select></label>
   <label className="text-xs font-medium">District<select className="mt-1 w-full rounded-lg border p-2 text-sm bg-white" value={district} disabled={!division} onChange={e=>{setDistrict(e.target.value);onDistrictChange(division,e.target.value);}}><option value="">Select district</option>{(bangladeshLocations[division]||[]).map(d=><option key={d}>{d}</option>)}</select></label>
  </div>
  {district && <div className="mt-3 rounded-lg bg-[#E8EEE9] p-2 text-xs text-[#174D3B]">{district}, {division}, Bangladesh</div>}
 </div>;
}
