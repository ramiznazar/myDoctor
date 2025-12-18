const DoctorProfile = require('../models/doctorProfile.model');

/**
 * Calculate distance between two coordinates (Haversine formula)
 * @param {number} lat1 - Latitude 1
 * @param {number} lon1 - Longitude 1
 * @param {number} lat2 - Latitude 2
 * @param {number} lon2 - Longitude 2
 * @returns {number} Distance in kilometers
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Get route from patient location to clinic
 * @param {Object} from - From coordinates {lat, lng}
 * @param {Object} to - To coordinates {lat, lng}
 * @returns {Promise<Object>} Route information
 */
const getRoute = async (from, to) => {
  const distance = calculateDistance(from.lat, from.lng, to.lat, to.lng);
  
  // Estimate travel time (assuming average speed of 30 km/h in city)
  const estimatedTimeMinutes = Math.round((distance / 30) * 60);
  
  // Placeholder for route steps (in real implementation, use Google Maps API)
  const routeSteps = [
    { instruction: 'Start from your location', distance: 0 },
    { instruction: 'Turn right onto Main Street', distance: 0.5 },
    { instruction: 'Continue straight for 2 km', distance: 2 },
    { instruction: 'Arrive at destination', distance: 0 }
  ];

  return {
    distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
    distanceUnit: 'km',
    estimatedTime: estimatedTimeMinutes,
    estimatedTimeUnit: 'minutes',
    routeSteps,
    from: { lat: from.lat, lng: from.lng },
    to: { lat: to.lat, lng: to.lng }
  };
};

/**
 * Get nearby clinics
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} radius - Radius in kilometers
 * @returns {Promise<Array>} Nearby clinics
 */
const getNearbyClinics = async (lat, lng, radius = 10) => {
  // Get all doctors with clinics
  const doctors = await DoctorProfile.find({
    clinics: { $exists: true, $ne: [] }
  }).populate('userId', 'fullName email phone profileImage status');

  const nearbyClinics = [];

  doctors.forEach(doctor => {
    if (doctor.userId && doctor.userId.status === 'APPROVED' && doctor.clinics) {
      doctor.clinics.forEach(clinic => {
        if (clinic.lat && clinic.lng) {
          const distance = calculateDistance(lat, lng, clinic.lat, clinic.lng);
          
          if (distance <= radius) {
            nearbyClinics.push({
              clinicId: clinic._id,
              doctorId: doctor.userId._id,
              doctorName: doctor.userId.fullName,
              clinicName: clinic.name,
              address: clinic.address,
              city: clinic.city,
              phone: clinic.phone,
              distance: Math.round(distance * 100) / 100,
              coordinates: { lat: clinic.lat, lng: clinic.lng }
            });
          }
        }
      });
    }
  });

  // Sort by distance
  nearbyClinics.sort((a, b) => a.distance - b.distance);

  return nearbyClinics;
};

/**
 * Get clinic location by ID
 * @param {string} clinicId - Clinic ID (from doctor profile clinics array)
 * @returns {Promise<Object>} Clinic location details
 */
const getClinicLocation = async (clinicId) => {
  // Find doctor profile containing this clinic
  const doctorProfile = await DoctorProfile.findOne({
    'clinics._id': clinicId
  }).populate('userId', 'fullName email phone profileImage');

  if (!doctorProfile) {
    throw new Error('Clinic not found');
  }

  const clinic = doctorProfile.clinics.id(clinicId);

  if (!clinic) {
    throw new Error('Clinic not found');
  }

  return {
    clinicId: clinic._id,
    doctorId: doctorProfile.userId._id,
    doctorName: doctorProfile.userId.fullName,
    clinicName: clinic.name,
    address: clinic.address,
    city: clinic.city,
    state: clinic.state,
    country: clinic.country,
    phone: clinic.phone,
    coordinates: {
      lat: clinic.lat,
      lng: clinic.lng
    },
    timings: clinic.timings,
    images: clinic.images
  };
};

module.exports = {
  getRoute,
  getNearbyClinics,
  getClinicLocation
};












