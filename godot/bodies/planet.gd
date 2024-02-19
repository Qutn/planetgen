extends Node3D

class_name Planet

const MIN_ORBIT = 0.2
const MAX_ORBIT = 50

const atmospheres = {
	'trace': ['trace'],
	'carbon_dioxide': ['carbon_dioxide_type_I', 'carbon_dioxide_type_II'],
	'hydrogen_helium': ['hydrogen_helium_type_I', 'hydrogen_helium_type_II', 'hydrogen_helium_type_III'],
	'ice': ['ice_type_I', 'ice_type_II'],
	'nitrogen': ['nitrogen_type_I', 'nitrogen_type_II', 'nitrogen_type_III'],
	'carbon': ['carbon_type_I'],
	'ammonia': ['ammonia_type_I']
	}
	

enum PLANET_TYPE {LAVA, GAS, ICE, DWARF, TERRESTRIAL, OCEAN}

const tilt_ranges = {
		PLANET_TYPE.DWARF: { 'min': 0, 'max': 30 },
		PLANET_TYPE.TERRESTRIAL: { 'min': 0, 'max': 25 },
		PLANET_TYPE.OCEAN: { 'min': 10, 'max': 30 },
		PLANET_TYPE.LAVA: { 'min': 0, 'max': 40 },
		PLANET_TYPE.GAS: { 'min': 15, 'max': 90 },
		PLANET_TYPE.ICE: { 'min': 10, 'max': 90 },
	}

var rng: RandomNumberGenerator

@export
var parent_star : Star

var orbit_radius: float # in AU

var planet_type: PLANET_TYPE

var size: float # in KM

var atmosphere: String

var moons: int

var axial_tilt: float

var planet_index: int

# Called when the node enters the scene tree for the first time.
func _ready():
	pass # Replace with function body.
	
func init(star: Star, random: RandomNumberGenerator, index: int = 0):
	parent_star = star
	planet_index = index
	
	rng = random
	
	orbit_radius = get_random_orbit_radius()
	planet_type = determine_planet_type()
	
	size = get_planet_size()
	atmosphere = get_planet_atmosphere()
	
	moons = get_moons()
	axial_tilt = get_axial_tilt()
	
	# Display stuff
	
	position.x = Distances.convert_au_to_fake_metres(orbit_radius)
	$mesh.mesh.radius = size
	$mesh.mesh.height = size
	
func get_random_orbit_radius():
	var luminosity = parent_star.luminosity
	var nb_of_planets = parent_star.nb_of_planets
	
	var inner_habitable = parent_star.habitable_zone.inner_boundary
	var outer_habitable = parent_star.habitable_zone.outer_boundary
	
	var min_orbit = MIN_ORBIT
	var max_orbit = max(MAX_ORBIT, outer_habitable + 20)
	
	var spacing_factor = (log(max_orbit) - log(min_orbit)) \
	 / nb_of_planets
	
	return exp((log(min_orbit) + spacing_factor) * planet_index)
	
func determine_planet_type():
	var luminosity = parent_star.luminosity
	var inner_habitable = parent_star.habitable_zone.inner_boundary
	var outer_habitable = parent_star.habitable_zone.outer_boundary
	
	if orbit_radius < inner_habitable:
		return PLANET_TYPE.LAVA
	elif orbit_radius >= inner_habitable and orbit_radius <= outer_habitable:
		var rn = rng.randf()
		
		if rn > 0.5:
			return PLANET_TYPE.TERRESTRIAL
		else:
			return PLANET_TYPE.OCEAN
	elif orbit_radius > outer_habitable and orbit_radius < outer_habitable + 15:
		return PLANET_TYPE.GAS
	elif orbit_radius >= outer_habitable + 5 && orbit_radius < 30:
		return PLANET_TYPE.ICE
	else:
		return PLANET_TYPE.DWARF
	
	

func get_planet_size():
	match planet_type:
		PLANET_TYPE.LAVA:
			return rng.randf_range(0.3, 1)
		PLANET_TYPE.TERRESTRIAL:
			return rng.randf_range(0.5, 1.5)
		PLANET_TYPE.OCEAN:
			return rng.randf_range(0.8, 2)
		PLANET_TYPE.GAS:
			return rng.randf_range(6, 15)
		PLANET_TYPE.ICE:
			return rng.randf_range(5, 14)
		PLANET_TYPE.DWARF:
			return rng.randf_range(0.1, 0.3)
		_:
			return 1
			
func get_random_atmosphere(arrays: Array):
	var list = []
	for array in arrays:
		if typeof(array) == TYPE_STRING:
			if array in atmospheres:
				array = atmospheres[array]
			else:
				array = [array]
		elif not typeof(array) == TYPE_ARRAY:
			array = [array]
		list.append_array(array)
	
	var index = rng.randi_range(0, len(list) - 1)
	return list[index]
	
func get_planet_atmosphere():
	var random_atmosphere = func(x): return floor(rng.randf() * len(x))
	
	match planet_type:
		PLANET_TYPE.TERRESTRIAL:
			if is_in_habitable_zone():
				return get_random_atmosphere(['carbon_dioxide', 'nitrogen'])
			else:
				return get_random_atmosphere(['carbon_dioxide'])
		PLANET_TYPE.OCEAN:
			return get_random_atmosphere(['carbon', 'ammonia', 'nitrogen'])
		
		PLANET_TYPE.ICE:
			return get_random_atmosphere(['ice', atmospheres['ammonia'][0]])
			
		PLANET_TYPE.GAS:
			return get_random_atmosphere(['hydrogen_helium', atmospheres['carbon'][0]])
		PLANET_TYPE.LAVA:
			return get_random_atmosphere(['carbon_dioxide'])
		PLANET_TYPE.DWARF:
			return get_random_atmosphere(['trace', 'carbon_dioxide'])
		_:
			return 'unknown'
	
func get_moons():
	match planet_type:
		PLANET_TYPE.TERRESTRIAL:
			return rng.randi_range(0,3)
		PLANET_TYPE.OCEAN:
			return rng.randi_range(0,2)
		PLANET_TYPE.GAS:
			return rng.randi_range(1,80)
		PLANET_TYPE.ICE:
			return rng.randi_range(1,50)
		PLANET_TYPE.LAVA:
			return rng.randi_range(0,2)
		PLANET_TYPE.DWARF:
			return rng.randi_range(0,5)
		_:
			return 0
	
func get_axial_tilt():
	var axial_range = tilt_ranges[planet_type]
	return rng.randf() * (axial_range['max'] - axial_range['min']) + axial_range['min']

func is_in_habitable_zone():
	var habitable_zone = parent_star.habitable_zone
	
	return orbit_radius >= habitable_zone.inner_boundary \
		and orbit_radius <= habitable_zone.outer_boundary

# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta):
	pass
