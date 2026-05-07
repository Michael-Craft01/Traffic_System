"use client";
import React from "react";
import { APIProvider } from "@vis.gl/react-google-maps";
import TrafficMap from "./TrafficMap";

export default function MapProvider({ children, path, altPath, pathColor, altPathColor, sensorData, onLocate }: { children?: React.ReactNode, path?: google.maps.LatLngLiteral[], altPath?: google.maps.LatLngLiteral[], pathColor?: string, altPathColor?: string, sensorData?: any, onLocate?: (fn: () => void) => void }) {
  // FIXED: Removed "routes" from libraries as it is not a valid Google Maps JS library name.
  // The Routes API is handled via REST fetch, not the JS SDK.
  return (
    <APIProvider 
      apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""} 
      region="ZW" 
      language="en"
      libraries={["places", "geometry"]}
    >
      <TrafficMap sensorData={sensorData} dynamicPath={path} altPath={altPath} pathColor={pathColor} altPathColor={altPathColor} onLocate={onLocate} />
      {children}
    </APIProvider>
  );
}
