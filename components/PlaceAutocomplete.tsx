"use client";
import React, { useEffect, useRef, useState } from "react";
import { X, MapPin, Loader2, AlertCircle } from "lucide-react";

interface Props {
  onPlaceSelect: (place: any) => void;
  onChange?: (val: string) => void;
  placeholder?: string;
  className?: string;
  defaultValue?: string;
  iconColor?: string;
}

export default function PlaceAutocomplete({ 
  onPlaceSelect, 
  onChange,
  placeholder = "Search for a place...", 
  className = "",
  defaultValue = "",
  iconColor = "bg-slate-900"
}: Props) {
  const [inputValue, setInputValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionTokenRef = useRef<string>("");

  useEffect(() => {
    setInputValue(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    // Generate a simple UUID for session token
    sessionTokenRef.current = Math.random().toString(36).substring(2, 15);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    if (onChange) onChange(val);

    if (val.length < 3) {
      setSuggestions([]);
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;

    setIsSearching(true);
    setError(null);

    try {
      // DIRECT REST API CALL (PLACES NEW) - Most reliable method
      const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
        },
        body: JSON.stringify({
          input: val,
          locationRestriction: {
            rectangle: {
              low: { latitude: -22.4, longitude: 25.2 },
              high: { latitude: -15.6, longitude: 33.1 }
            }
          },
          sessionToken: sessionTokenRef.current
        })
      });

      const data = await response.json();

      if (data.error) {
        if (data.error.message.includes("API has not been used")) {
           setError("Please enable 'Places API (New)' in Google Console.");
        } else {
           setError(data.error.message);
        }
        setSuggestions([]);
      } else {
        setSuggestions(data.suggestions || []);
        setShowSuggestions(true);
      }
    } catch (err) {
      console.error("Direct Autocomplete Error:", err);
    }
    setIsSearching(false);
  };

  const handleSelect = async (suggestion: any) => {
    const placeId = suggestion.placePrediction?.placeId;
    const displayName = suggestion.placePrediction?.text?.text || "";
    
    setInputValue(displayName);
    if (onChange) onChange(displayName);
    setShowSuggestions(false);
    setSuggestions([]);

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || !placeId) return;

    setIsSearching(true);
    try {
      // DIRECT REST API CALL (PLACE DETAILS NEW)
      const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}?fields=id,displayName,formattedAddress,location&key=${apiKey}`);
      const place = await response.json();

      if (place && place.location) {
        onPlaceSelect({
          formattedAddress: place.formattedAddress,
          displayName: place.displayName?.text,
          location: { 
            lat: place.location.latitude, 
            lng: place.location.longitude 
          }
        });
      }
    } catch (err) {
      console.error("Direct Place Details Error:", err);
    }
    setIsSearching(false);
    
    // Refresh session token
    sessionTokenRef.current = Math.random().toString(36).substring(2, 15);
  };

  return (
    <div ref={containerRef} className={`relative w-full transition-all duration-300 ${showSuggestions ? 'z-[9999]' : 'z-[10]'}`}>
      <div className={`flex items-center gap-2 bg-white rounded-xl px-3 border ${error ? 'border-red-300' : 'border-slate-200'} focus-within:ring-2 focus-within:ring-blue-500/20 shadow-sm transition-all ${className}`}>
        <div className={`w-2 h-2 rounded-full shrink-0 ${iconColor}`} />
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder={placeholder}
          className="flex-1 bg-transparent border-none py-3 text-sm font-bold placeholder-slate-400 focus:outline-none"
        />
        {isSearching && <Loader2 size={14} className="animate-spin text-slate-300" />}
        {inputValue && !isSearching && (
          <button 
            type="button"
            onClick={() => { setInputValue(""); setSuggestions([]); if (onChange) onChange(""); setError(null); }}
            className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {error && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-red-50 text-red-600 text-[10px] font-bold p-2 rounded-lg border border-red-100 flex items-center gap-2 z-[10001]">
          <AlertCircle size={12} /> {error}
        </div>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden max-h-[300px] overflow-y-auto z-[10000]">
          {suggestions.map((s, i) => (
            <button 
              key={i} 
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(s);
              }} 
              className="w-full flex items-start gap-3 p-4 hover:bg-blue-50 text-left border-b border-slate-50 last:border-none transition-colors"
            >
              <div className="mt-0.5 p-1.5 bg-slate-100 rounded-lg text-slate-400 shrink-0"><MapPin size={14} /></div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-bold text-slate-900 truncate">
                  {s.placePrediction?.text?.text}
                </p>
                <p className="text-[10px] font-medium text-slate-400 truncate">
                  {s.placePrediction?.structuredFormat?.mainText?.text}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
