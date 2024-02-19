extends Node3D

var parent_star : Star = null

# Called when the node enters the scene tree for the first time.
func _ready():
	init()
	
func init(seed = null):
	parent_star = preload("res://bodies/Star.tscn").instantiate()
	
	parent_star.generate_star()
	
	add_child(parent_star)


# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta):
	pass
