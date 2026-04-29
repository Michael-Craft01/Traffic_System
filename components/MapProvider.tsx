"use client";
import React from "react";
import { APIProvider } from "@vis.gl/react-google-maps";
import TrafficMap from "./TrafficMap";

export default function MapProvider({ children, path, sensorData }: { children?: React.ReactNode, path?: google.maps.LatLngLiteral[], sensorData?: any }) {
  // FIXED: Removed "routes" from libraries as it is not a valid Google Maps JS library name.
  // The Routes API is handled via REST fetch, not the JS SDK.
  return (
    <APIProvider 
      apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""} 
      region="ZW" 
      language="en"
      libraries={["places", "geometry"]}
    >
      <TrafficMap sensorData={sensorData} dynamicPath={path} />
      {children}
    </APIProvider>
  );
}
