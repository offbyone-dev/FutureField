import { useEffect } from 'react';
import { useMap, useMapEvents, Marker, Popup, CircleMarker } from 'react-leaflet';

type Props = {
 coordinates: [number,number] | null;
 selectedPoint: [number,number] | null;
 onPointSelect: (p:[number,number]) => void;
 drawing: boolean;
 vertices: [number,number][];
 onVertexAdd: (p:[number,number]) => void;
};
export default function MapController({coordinates,selectedPoint,onPointSelect,drawing,vertices,onVertexAdd}:Props){
 const map=useMap();
 useEffect(()=>{if(coordinates) map.flyTo(coordinates,11,{animate:true,duration:1.4});},[coordinates,map]);
 useMapEvents({click(event){const p:[number,number]=[event.latlng.lat,event.latlng.lng]; if(drawing) onVertexAdd(p); else onPointSelect(p);}});
 return <>{!drawing && selectedPoint && <Marker position={selectedPoint}><Popup>Selected location: {selectedPoint[0].toFixed(5)}, {selectedPoint[1].toFixed(5)}</Popup></Marker>}{vertices.map((p,i)=><CircleMarker key={i} center={p} radius={5} pathOptions={{color:'#174D3B',fillColor:'#fff',fillOpacity:1}} />)}</>;
}
