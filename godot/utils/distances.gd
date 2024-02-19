extends Node

const FM_PER_AU = 149.598 # 149,598,000 KM but we divide by a million

func convert_au_to_fake_metres(au: float):
	return au * FM_PER_AU
# Called when the node enters the scene tree for the first time.
func _ready():
	pass # Replace with function body.


# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta):
	pass
