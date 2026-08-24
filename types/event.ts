export type FoodEvent = {
  id: number;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  building: string;
  room: string | null;
  latitude: number | null;
  longitude: number | null;
  food_type: string | null;
  is_free: boolean;
  registration_required: boolean;
  source_name: string | null;
  source_url: string | null;
  confidence: number;
};
