extends Node3D

class_name Planet

const MIN_ORBIT = 0.2
const MAX_ORBIT = 50

enum PLANET_TYPE {LAVA, GAS, ICE, DWARF, TERRESTRIAL, OCEAN}

var rng: RandomNumberGenerator

@export
var parent_star : Star

var orbit_radius: float

var planet_type: float

var size: float

var atmosphere: float

var moons: Array

var axial_tilt: float

var planet_index: int

# Called when the node enters the scene tree for the first time.
func _ready():
	pass # Replace with function body.
	
func init(star: Star, rng: RandomNumberGenerator, index: int = 0):
	parent_star = star
	planet_index = index
	
	orbit_radius = get_random_orbit_radius()
	planet_type = determine_planet_type()
	
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
	
func get_planet_atmosphere():
	pass

func get_moons():
	pass
	
func get_axial_tilt():
	pass


# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta):
	pass
