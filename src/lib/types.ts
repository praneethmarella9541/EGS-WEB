/** Two roles only: admin (full access) and user (feature-restricted). */
export type UserRole = 'admin' | 'user';

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  role: UserRole;
  /** Feature keys a normal user is NOT allowed to access. Ignored for admins. */
  restricted_features: string[];
  mobile_phone: string | null;
  /** Has this (non-admin) user completed face registration? Always true for admins. */
  face_registered: boolean;
}

/**
 * How the place on a visit was obtained. Coordinates are machine-captured in
 * every case — this records how much the *user* steered the choice, which is
 * the admin's scrutiny signal now that distance_m is near-zero by construction.
 */
export type PlaceSource = 'nearby' | 'reverse_geocode' | 'manual_search';

/** An admin-assigned area for a user on a given date — a free-text label, no pin. */
export interface Assignment {
  id: string;
  user_id: string;
  assigned_date: string; // YYYY-MM-DD
  area_label: string; // e.g. "Sector 4-7, Gurgaon" — admin-typed, no geocoding
  /** Optional override of the global field form for this area. Null = use the default. */
  form_id: string | null;
  form_url: string | null;
  created_by: string;
  created_at: string;
}

/** One photo attached to a location visit. */
export interface VisitPhoto {
  id: string;
  visit_id: string;
  photo_path: string;
}

/**
 * A user-logged visit to a specific place within their assigned area. The place
 * is captured from the device's live GPS (nearby buildings/schools around the
 * user), so the coordinates are never user-supplied — only the label can be
 * edited. The user must still be within 200 m of it at submit time. N per
 * assignment per day (unlimited, user-driven).
 */
export interface LocationVisit {
  id: string;
  assignment_id: string;
  user_id: string;
  place_label: string; // name/address of the place visited
  latitude: number; // device's live GPS at submit time
  longitude: number;
  distance_m: number; // distance between live GPS and the picked place
  notes: string;
  submitted_at: string;
  /** Google place_id of the picked place; null for reverse-geocoded addresses. */
  place_id: string | null;
  /** Null on visits logged before the GPS-first flow existed. */
  place_source: PlaceSource | null;
  /** User typed over the fetched name — coordinates are unaffected. */
  label_edited: boolean;
  gps_accuracy_m: number | null;
  /** When the location was fetched; gap to submitted_at is a tamper signal. */
  fetched_at: string | null;
  photos: VisitPhoto[];
}

/** Assignment joined with its visits so far — used on the user task screen. */
export interface AssignmentWithVisits extends Assignment {
  visits: LocationVisit[];
}

/** Assignment joined with visits + the assignee's profile — admin Attendance tab. */
export interface AdminAssignmentRow extends Assignment {
  visits: LocationVisit[];
  profile: { display_name: string | null; email: string } | null;
}
