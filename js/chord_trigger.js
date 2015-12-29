// general web MIDI variables
var midiAccess;
var selectedInput;
var selectedOutput;

// chord trigger variables
var activePad = 103;
var playedNotes = [];
var chordMap = {};
var lsKey = 'chord_banks';
if (!localStorage[lsKey]) localStorage[lsKey] = JSON.stringify({});

// Page initialization
$(document).ready(function () {
	if (navigator.requestMIDIAccess !== undefined) {
		navigator.requestMIDIAccess().then(initMIDI, alert);
	} else {
		alert('No access to MIDI devices: browser does not support Web MIDI! :(');
	}

	$('#selInputs').change(function() {
		var inputs = midiAccess.inputs;
		inputs.forEach(function(port) {
			if (port.id === $('#selInputs :selected').val()) {
				selectedInput = port;
			}
		});
	});

	$('#selOutputs').change(function() {
		var outputs = midiAccess.outputs;
		selectedOutput = null;
		outputs.forEach(function(port) {
			if (port.id === $('#selOutputs :selected').val()) {
				selectedOutput = port;
			}
		});
	});
	
	// Draw the pads
	var offset = 103;
	var group = -1;
	var groups = {
		0: $('<tr>'),
		1: $('<tr>'),
		2: $('<tr>'),
		3: $('<tr>')
	};

	for(var i = 0; i < 16; i++) {
		if (i % 4 === 0) group++;
		var cell = $('<td>').attr('id', 'cc' + (i + offset)).attr('title', 'CC ' + (i + offset)).data('cc', (i + offset));
		groups[group].append(cell);
	}
	$('#pads').append(groups[3]);
	$('#pads').append(groups[2]);
	$('#pads').append(groups[1]);
	$('#pads').append(groups[0]);
	$('#cc103').addClass('learning');

	// Draw the chord set file section
	drawFileMenu();

	$('#btnSave').click(function() {
		var sets = JSON.parse(localStorage[lsKey]);
		var slot = prompt('Enter save slot name:', localStorage['last_chord_bank']);
		if (slot) {
			sets[slot] = chordMap;
			localStorage['last_chord_bank'] = slot;
			localStorage[lsKey] = JSON.stringify(sets);
			drawFileMenu();
		}
	});

	$(document).on('click', '#monitor a', function() {
		var sets = JSON.parse(localStorage[lsKey]);
		chordMap = sets[$(this).attr('href')];
		return false;
	});

	$(document).on('mousedown', '#pads td', function() {
		pad($(this).data('cc'), 127);
	});

	$(document).on('mouseup', '#pads td', function() {
		pad($(this).data('cc'), 0);
	});
});

// When MIDI access is requested this function is run.
function initMIDI(access) {
	midiAccess = access;
	showMIDIPorts();
	midiAccess.onstatechange = showMIDIPorts;
	// hooks up to listen on all MIDI devices
	for (var input of midiAccess.inputs.values())
		input.onmidimessage = midiMessageReceived;
}

// Populates select box with MIDI port list.
function showMIDIPorts() {
	var inputs = midiAccess.inputs;
	var first = true;
	inputs.forEach(function(port) {
		if (first && !selectedInput) selectedInput = port;
		else first = false;
		if (!_.contains(_.pluck($('#selInputs option'), 'value'), port.id)) {
			$('#selInputs').append($('<option>').val(port.id).text(port.manufacturer + " " + port.name));
		}
	});

	var outputs = midiAccess.outputs;
	first = true;
	outputs.forEach(function(port) {
		if (first && !selectedOutput) selectedOutput = port;
		if (!_.contains(_.pluck($('#selOutputs option'), 'value'), port.id)) {
			$('#selOutputs').append($('<option>').val(port.id).text(port.manufacturer + " " + port.name).prop('selected', first));
		}
		first = false;
	});

	if (inputs.length === 0) alert('No inputs are available! :(');
	if (outputs.length === 0) alert('No outputs are available! :(');
}


// Every time we receive a MIDI message, determine whether it's a note and deal with it accordingly.
function midiMessageReceived(ev) {
	var cmd = ev.data[0] >> 4;
	var channel = ev.data[0] & 0xf;
	var noteNumber = ev.data[1];
	var velocity = 0;
	if (ev.data.length > 2)
		velocity = ev.data[2];

	// MIDI noteon with velocity = 0 is the same as noteoff
	if (cmd === 8 || ((cmd === 9) && (velocity === 0))) { // noteoff
		if (ev.currentTarget.name === selectedInput.name) {
	  		noteOff(noteNumber, channel);
		}
	} else if (cmd === 9) { // note on
		if (ev.currentTarget.name === selectedInput.name) {
			noteOn(noteNumber, velocity, channel);
		}
	} else if (cmd === 11) { // controller message
	  pad(noteNumber, velocity);
	}
}

function pad(cc, velocity) {
	var td = $('#cc' + cc);
	if (velocity > 0) { // on
		$('.learning').removeClass('learning');
		td.addClass('active');
		if (isLearning()) {
			activePad = cc;
			td.addClass('learning');
		}
		if (chordMap[cc]) $.each(chordMap[cc], function(i, noteNumber) {
			stopPlayingNote(noteNumber);
			playNote(noteNumber);
		});
	} else { // off
		td.removeClass('active');
		if (chordMap[cc]) $.each(chordMap[cc], function(i, noteNumber) {
			stopPlayingNote(noteNumber);
		});
	}
}

// this function is performed whenever a note is turned on
function noteOn(noteNumber) {
	if (!isLearning()) return;
	playNote(noteNumber);
	if (!chordMap[activePad] || playedNotes.length === 0) {
		chordMap[activePad] = [];
	}
	playedNotes.push(noteNumber);
	chordMap[activePad].push(noteNumber);
}

// this function is performed whenever a note is turned off
function noteOff(noteNumber) {
	stopPlayingNote(noteNumber);
	removeFromList(playedNotes, noteNumber);
}

// // MIDI functions
function playNote(noteNumber) {
	if (selectedOutput) selectedOutput.send([0x90, noteNumber, 127]);
	//else swsNoteOn(MIDIUtils.noteNumberToFrequency(noteNumber));
}

function stopPlayingNote(noteNumber) {
	if (selectedOutput) selectedOutput.send([0x90, noteNumber, 0]);
	//else swsNoteOff(MIDIUtils.noteNumberToFrequency(noteNumber));
}

// helper function to show whether we're listening
function isLearning() {
	return $('#cbLearn').prop('checked');
}

// helper function to remove an item from a list
function removeFromList(list, val) {
	var index = list.indexOf(val);
	if (val > -1) list.splice(index, 1);
}

// draw chord set loading menu
function drawFileMenu() {
	var sets = JSON.parse(localStorage[lsKey]);
	$('#monitor a').remove();
	for (key in sets) {
		$('#monitor').append($('<a>').attr('href', key).text(key));
	}
}