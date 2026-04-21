"use client";
import React from "react";
import { APIProvider } from "@vis.gl/react-google-maps";

export default function MapProvider({ children }: { children: React.ReactNode }) {
  // If API key is missing, it will throw a warning in console but shouldn't crash the app.
  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""} region="ZW" language="en">
      {children}
    </APIProvider>
  );
}
