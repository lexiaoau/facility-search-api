export interface FacilityLocation {
  lat: number;
  lng: number;
}

export interface Facility {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  facilities: string[];
  location: FacilityLocation;
}
