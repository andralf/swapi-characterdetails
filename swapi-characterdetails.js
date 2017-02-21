var swapi = require('swapi-node');
var js2xmlparser = require("js2xmlparser");
var express = require('express');

var app = express();
var myapi = myapi || {};
var attribsToCopy = ['birth_year', 'film_names', 'gender', 'hair_color', 'homeworld_name', 'name', 'skin_color', 'specie_names', 'starship_names', 'vehicle_names'];

myapi.findCharacterFromResult = function(result, name){
	for (var i in result.results){
		var p = result.results[i];
		console.log('Potential character name: ' + p.name);
		if (p.name == name){
			console.log('!!!!! MATCHING character name: ' + p.name);
			return p;
		}
	}
}

myapi.getRelatedInfoUrl = function(url){
	return swapi.get(url);
}

myapi.getRelatedInfoIdentifiers = function(relatedInfoUrls, identiferFieldName){
	var promises = [];
	for (var i in relatedInfoUrls) promises.push(myapi.getRelatedInfoUrl(relatedInfoUrls[i]));

	return new Promise(function(resolve, reject){
		Promise.all(promises).then(items => {
			var itemIdentifiers = "";
			for (var j = 0; j < items.length; j++){
				itemIdentifiers += items[j][identiferFieldName];
				if (items.length > 1 && j < (items.length - 1)) itemIdentifiers += ", ";
			}
			resolve(itemIdentifiers);
		})
	});
}

myapi.nextCharacterPage = function (nextUrl, name, resolve, reject){
	swapi.get(nextUrl)
		.then(myapi.characterResultsHandler(resolve, reject, name))
		.catch(function (reason){
			reject(reason);
		});
}

myapi.characterResultsHandler = function(resolve, reject, name){
	return function(result){
		var person = myapi.findCharacterFromResult(result, name);
		if (person){
			var p2 = {};
			for (var j in attribsToCopy){
				p2[attribsToCopy[j]] = person[attribsToCopy[j]];
			}	

			var relatedInfoPromises = [];
			relatedInfoPromises.push(myapi.getRelatedInfoIdentifiers(person.films, 'title'));
			relatedInfoPromises.push(myapi.getRelatedInfoIdentifiers([person.homeworld], 'name'));
			relatedInfoPromises.push(myapi.getRelatedInfoIdentifiers(person.species, 'name'));
			relatedInfoPromises.push(myapi.getRelatedInfoIdentifiers(person.starships, 'name'));
			relatedInfoPromises.push(myapi.getRelatedInfoIdentifiers(person.vehicles, 'name'));

			Promise.all(relatedInfoPromises).then(values => {
				p2.film_names = values[0];
				p2.homeworld_name = values[1];
				p2.specie_names = values[2];
				p2.starship_names = values[3];
				p2.vehicle_names = values[4];

				resolve(p2);	
			});
			
			return;
		}
		if (result.next) myapi.nextCharacterPage(result.next, name, resolve, reject);
		else reject('Character not found');
	};	
}

myapi.getCharacter = function(name){
	return new Promise(function(resolve, reject){
		swapi.getPerson()
			.then(myapi.characterResultsHandler(resolve, reject, name))
			.catch(function (reason){
				reject(reason);
			});
		}
	);
};

app.get('/v1/api/character', function(req, res){

	myapi.getCharacter(req.query.name).then(function (result){
		
		var xml = js2xmlparser.parse("character", result);

		console.log('TO XML: ' + xml);
		res.set('Content-Type', 'text/xml').send(xml);
		
	}).catch(function (reason){
		console.error('Error: ' + reason);
		res.send(reason);
	});
});

var server = app.listen(8081, function () {

	var host = server.address().address
	var port = server.address().port

	console.log("Star Wars Dictionary REST API listening at http://%s:%s", host, port);
});

