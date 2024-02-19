extends Node3D

class_name Star

enum STAR_TYPE {M, K, G, F, A, B, O}

var random = RandomNumberGenerator.new()

@export_category("Star properties")
@export
var star_type : STAR_TYPE

@export
var age : float

@export
var size : float
		
@export
var mass : float

var habitable_zone : HabitableZone = HabitableZone.new(luminosity)

@onready
var star_light = get_node("star_light")

@export
var luminosity : float :
	set(value):
		luminosity = value
		habitable_zone.set_luminosity(value)
		
		if star_light != null:
			star_light.light_energy = luminosity

@export_category("Random Generation")
@export
var seed : String:
	set(value):
		true_seed = seed.hash()
		random.seed = true_seed

var true_seed

		

# Called when the node enters the scene tree for the first time.
func _ready():
	luminosity = luminosity # Force set call
	generate_star()
	

func generate_star():
	var key = STAR_TYPE.keys()[random.randi_range(0, len(STAR_TYPE.keys())-1)]
	star_type = STAR_TYPE[key]
	
	generate_star_age()
	generate_size_and_mass()
	generate_star_luminosity()
	


# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta):
	pass
	
	
func generate_star_age():
	match star_type:
		STAR_TYPE.M:
			age = random.randf_range(1, 5000)
		STAR_TYPE.K:
			age = random.randf_range(1, 30)
		STAR_TYPE.G:
			age = random.randf_range(1, 10)
		STAR_TYPE.F:
			age = random.randf_range(1, 4)
		STAR_TYPE.A:
			age = random.randf_range(0.1, 3)
		STAR_TYPE.B:
			age = random.randf_range(0.01, 0.5)
		STAR_TYPE.O:
			age = random.randf_range(0.001, 0.1)
		_:
			age = 0
			
func generate_size_and_mass():
	match star_type:
		STAR_TYPE.M:
			size = random.randf_range(0.1, 0.7)
			mass = random.randf_range(0.08, 0.45)
		STAR_TYPE.K:
			size = random.randf_range(0.7, 0.96)
			mass = random.randf_range(0.45, 0.8)
		STAR_TYPE.G:
			size = random.randf_range(0.96, 1.15)
			mass = random.randf_range(0.8, 1.04)
		STAR_TYPE.F:
			size = random.randf_range(1.15, 1.4)
			mass = random.randf_range(1.04, 1.4)
		STAR_TYPE.A:
			size = random.randf_range(1.4, 1.8)
			mass = random.randf_range(1.4, 2.1)
		STAR_TYPE.B:
			size = random.randf_range(1.8, 6.6)
			mass = random.randf_range(2.1, 16)
		STAR_TYPE.O:
			size = random.randf_range(6.6, 20)
			mass = random.randf_range(16, 90)
		_:
			size = 0
			mass = 0
			
func generate_star_luminosity():
	match star_type:
		STAR_TYPE.M:
			luminosity = size * 0.08
		STAR_TYPE.K:
			luminosity = size * 0.6
		STAR_TYPE.G:
			luminosity = size
		STAR_TYPE.F:
			luminosity = size * 1.5
		STAR_TYPE.A:
			luminosity = size * 5
		STAR_TYPE.B:
			luminosity = size * 25
		STAR_TYPE.O:
			luminosity = size * 50
		_:
			luminosity = 0

class HabitableZone:
	const INNER_BOUNDARY = 0.95
	const OUTER_BOUNDARY = 1.37
	var inner_boundary : float
	var outer_boundary : float
	
	func set_luminosity(lumi: float):
		inner_boundary = INNER_BOUNDARY * sqrt(lumi)
		outer_boundary = OUTER_BOUNDARY * sqrt(lumi)
	
	func _init(lumi: float):
		set_luminosity(lumi)
