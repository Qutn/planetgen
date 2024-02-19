extends Object

class StarType:
	var size_min : float
	var size_max : float
	
	var mass_min : float
	var mass_max : float
	
	var age_min : float
	var age_max : float
	
	func _init(min_size, max_size, min_mass, max_mass, min_age, max_age):
		size_min = min_size
		size_max = max_size
		
		mass_min = min_mass
		mass_max = max_mass
		
		age_min = min_age
		age_max = max_age

var M = StarType.new(0.1, 0.7, 0.08, 0.45, 1, 5000)
