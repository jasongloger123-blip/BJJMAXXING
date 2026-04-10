'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

// Dark Mode Map Style - BJJMAXXING Style (dunkelblau/grau)
// Alle POIs (Points of Interest) sind ausgeblendet
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#161d29' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9aa7bd' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#313d54' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#eef2f8' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.attraction', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.government', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.medical', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.place_of_worship', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.school', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.sports_complex', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit.station', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#20293a' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2a3446' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#090c13' }] },
]

type Gym = {
  id: string
  name: string
  address: string | null
  city: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
  website: string | null
  phone: string | null
  email: string | null
  description: string | null
  member_count: number
  created_at: string
}

interface GymMapProps {
  gyms: Gym[]
  selectedGym: Gym | null
  onGymSelect: (gym: Gym) => void
}

export function GymMap({ gyms, selectedGym, onGymSelect }: GymMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isMapReady, setIsMapReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Create custom marker icon with number
  const createMarkerIcon = useCallback((count: number, isSelected: boolean): google.maps.Icon => {
    const size = isSelected ? 50 : count > 9 ? 46 : 40
    const fillColor = isSelected ? '#d4875f' : '#10b981'
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="${fillColor}" stroke="white" stroke-width="2"/>
        <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-family="Arial, sans-serif" font-size="${size * 0.4}px" font-weight="bold">${count}</text>
      </svg>
    `
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new google.maps.Size(size, size),
      anchor: new google.maps.Point(size/2, size/2),
    }
  }, [])

  // Calculate clustering distance based on zoom level
  const getClusterDistance = useCallback((zoom: number): number => {
    // Lower zoom = larger distance threshold (more clustering)
    // Higher zoom = smaller distance threshold (less clustering)
    if (zoom >= 15) return 0.0001  // ~10m - individual markers
    if (zoom >= 13) return 0.0005  // ~50m
    if (zoom >= 11) return 0.001   // ~100m
    if (zoom >= 9) return 0.005    // ~500m
    if (zoom >= 7) return 0.01     // ~1km
    return 0.05                     // ~5km - heavy clustering
  }, [])

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      setError('Google Maps API Key fehlt')
      setIsLoading(false)
      return
    }

    setOptions({
      key: apiKey,
      v: 'weekly',
      libraries: ['places'],
    })

    importLibrary('maps')
      .then(() => {
        if (!mapRef.current) return

        const map = new google.maps.Map(mapRef.current, {
          center: { lat: 51.1657, lng: 10.4515 },
          zoom: 6,
          styles: DARK_MAP_STYLE,
          clickableIcons: false,
          mapTypeControl: true,
          mapTypeControlOptions: {
            style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
            position: google.maps.ControlPosition.TOP_LEFT,
          },
          streetViewControl: false,
          fullscreenControl: true,
          fullscreenControlOptions: {
            position: google.maps.ControlPosition.TOP_RIGHT,
          },
          zoomControl: true,
          zoomControlOptions: {
            position: google.maps.ControlPosition.RIGHT_BOTTOM,
          },
          gestureHandling: 'greedy',
        })

        mapInstanceRef.current = map
        setIsLoading(false)
        setIsMapReady(true)
      })
      .catch((err) => {
        console.error('Error loading Google Maps:', err)
        setError('Google Maps konnte nicht geladen werden')
        setIsLoading(false)
      })

    return () => {
      markersRef.current.forEach(marker => marker.setMap(null))
      markersRef.current = []
    }
  }, [])

  // Function to update markers (called on zoom change and data change)
  const updateMarkers = useCallback((zoom?: number) => {
    if (!mapInstanceRef.current || !window.google) return
    
    const map = mapInstanceRef.current
    const currentZoom = zoom ?? map.getZoom() ?? 6
    const clusterDistance = getClusterDistance(currentZoom)

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null))
    markersRef.current = []

    // Filter gyms with valid coordinates
    const gymsWithCoords = gyms.filter(gym => 
      gym.latitude !== null && 
      gym.longitude !== null && 
      !isNaN(gym.latitude) && 
      !isNaN(gym.longitude)
    )

    if (gymsWithCoords.length === 0) {
      return
    }

    // Group gyms by location (dynamic clustering based on zoom)
    const locationGroups: Gym[][] = []
    
    gymsWithCoords.forEach((gym) => {
      let addedToGroup = false
      
      // Try to add to an existing group
      for (const group of locationGroups) {
        const firstGym = group[0]
        const distance = Math.sqrt(
          Math.pow(gym.latitude! - firstGym.latitude!, 2) + 
          Math.pow(gym.longitude! - firstGym.longitude!, 2)
        )
        
        if (distance <= clusterDistance) {
          group.push(gym)
          addedToGroup = true
          break
        }
      }
      
      // Create new group if not added
      if (!addedToGroup) {
        locationGroups.push([gym])
      }
    })

    // Create markers for each group
    locationGroups.forEach((groupGyms) => {
      // Use average position for cluster marker
      const avgLat = groupGyms.reduce((sum, g) => sum + g.latitude!, 0) / groupGyms.length
      const avgLng = groupGyms.reduce((sum, g) => sum + g.longitude!, 0) / groupGyms.length
      
      const firstGym = groupGyms[0]
      const isSelected = selectedGym && groupGyms.some(g => g.id === selectedGym.id)
      
      const marker = new google.maps.Marker({
        position: { lat: avgLat, lng: avgLng },
        map,
        icon: createMarkerIcon(groupGyms.length, !!isSelected),
        title: groupGyms.length === 1 ? firstGym.name : `${groupGyms.length} Gyms`,
        animation: isSelected ? google.maps.Animation.BOUNCE : null,
      })

      // Create info window
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; min-width: 150px; font-family: system-ui, sans-serif; background: #161d29; border-radius: 8px; color: white;">
            ${groupGyms.map(gym => `
              <div style="margin-bottom: 6px; padding-bottom: 6px; border-bottom: 1px solid #2a3446;">
                <div style="font-weight: 600; color: #d4875f; font-size: 14px;">${gym.name}</div>
                <div style="color: #9aa7bd; font-size: 12px;">${gym.city || 'Unbekannter Ort'}</div>
              </div>
            `).join('')}
          </div>
        `,
      })

      // Click handler
      marker.addListener('click', () => {
        if (groupGyms.length === 1) {
          onGymSelect(groupGyms[0])
        } else {
          onGymSelect(groupGyms[0])
        }
        infoWindow.open(map, marker)
      })

      markersRef.current.push(marker)
    })
  }, [gyms, selectedGym, onGymSelect, createMarkerIcon, getClusterDistance])

  // Update markers when gyms change or map is ready, and setup zoom listener
  useEffect(() => {
    if (!isMapReady || !mapInstanceRef.current || !window.google) return

    const map = mapInstanceRef.current

    // Filter gyms with valid coordinates
    const gymsWithCoords = gyms.filter(gym => 
      gym.latitude !== null && 
      gym.longitude !== null && 
      !isNaN(gym.latitude) && 
      !isNaN(gym.longitude)
    )

    // Fit bounds to show all markers on initial load
    if (gymsWithCoords.length > 0 && !selectedGym) {
      const bounds = new google.maps.LatLngBounds()
      gymsWithCoords.forEach(gym => {
        bounds.extend({ lat: gym.latitude!, lng: gym.longitude! })
      })
      
      map.fitBounds(bounds, 80)
    }

    // Pan to selected gym
    if (selectedGym?.latitude && selectedGym?.longitude) {
      map.panTo({ lat: selectedGym.latitude, lng: selectedGym.longitude })
      map.setZoom(14)
    }

    // Update markers after bounds are set
    updateMarkers(map.getZoom() ?? 6)

    // Listen for zoom changes to update clustering
    const zoomListener = map.addListener('zoom_changed', () => {
      updateMarkers(map.getZoom())
    })

    return () => {
      // Cleanup zoom listener
      if (zoomListener) {
        google.maps.event.removeListener(zoomListener)
      }
    }
  }, [gyms, selectedGym, updateMarkers, isMapReady])

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-[2.25rem] bg-bjj-surface text-center p-8">
        <p className="text-bjj-muted">{error}</p>
        <p className="mt-2 text-sm text-bjj-muted/60">
          Stelle sicher, dass NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in deiner .env gesetzt ist
        </p>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      {(isLoading || !isMapReady) && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[2.25rem] bg-bjj-surface">
          <div className="text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-bjj-gold border-t-transparent" />
            <p className="mt-4 text-sm text-bjj-muted">Karte wird geladen...</p>
          </div>
        </div>
      )}
      <div ref={mapRef} className="h-full w-full rounded-[2.25rem]" />
    </div>
  )
}
