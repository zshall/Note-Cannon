(function() {

	var noteMap = {};
	var noteNumberMap = [];
	var notes = [ "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B" ];
	// http://www.electronics.dit.ie/staff/tscarff/Music_technology/midi/midi_note_numbers_for_octaves.htm


	for(var i = 0; i < 127; i++) {

		var index = i,
			key = notes[ index % 12 ],
			octave = ((index / 12) | 0) - 1; // MIDI scale starts at octave = -1
		
		//	i believe that the 'b' means flat and the # means sharp
		// 	sound fonts seem to use the 'b' notation rather then the '#'
		// 	so I'm including the 'b' notation as well.
		// 	however, this set up will only return sharp notes with noteToName
		// 	
		// 	from what I saw in wikipedia that should mean that F# === Gb, right?
		//	Db == C#, Eb == D#, Fb == E, Gb == F#, Ab == G#, Bb == A#, Cb == B

		if( key.length === 2 ){
			if( key === 'A#')	noteMap[ 'Bb' + octave ] = i;
			else if( key === 'C#')	noteMap[ 'Db' + octave ] = i;
			else if( key === 'D#')	noteMap[ 'Eb' + octave ] = i;
			else if( key === 'C#')	noteMap[ 'Db' + octave ] = i;
			else if( key === 'G#')	noteMap[ 'Ab' + octave ] = i;
			else if( key === 'F#')	noteMap[ 'Gb' + octave ] = i;
		}
		
		key += octave;

		noteMap[key] = i;
		noteNumberMap[i] = key;

	}


	function getBaseLog(value, base) {
		return Math.log(value) / Math.log(base);
	}


	var MIDIUtils = {

		noteNameToNoteNumber: function(name) {
			return noteMap[name];
		},

		noteNumberToFrequency: function(note) {
			return 440.0 * Math.pow(2, (note - 69.0) / 12.0);
		},

		noteNumberToName: function(note) {
			return noteNumberMap[note];
		},

		frequencyToNoteNumber: function(f) {
			return Math.round(12.0 * getBaseLog(f / 440.0, 2) + 69);
		},

		noteMap: noteMap,

		noteNumberMap: noteNumberMap

	};


	// Make it compatible for require.js/AMD loader(s)
	if(typeof define === 'function' && define.amd) {
	} else if(typeof module !== 'undefined' && module.exports) {
		// And for npm/node.js
		module.exports = MIDIUtils;
	} else {
		this.MIDIUtils = MIDIUtils;
	}


}).call(this);