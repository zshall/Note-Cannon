// general web MIDI variables
var midiAccess;
var selectedInput;
var selectedOutput;
var queue = []; // the queue. for now we'll only support one note cannon
var previewQueue = []; // preview queue for hearing before adding
var lastQueue = []; // last queue for retroactively adding
var keyPositions = {}; // keep a dictionary of which keys held correspond to which notes
var replaceOnRest = true; // if this flag is set then clear the queue the next note played
// TODO: allow MIDI input to be used in "performance" mode or define an octave or note range for each cannon

// the position in the current queue
var position = -1;

$(document).ready(function() {
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
				hookUpMIDI(selectedInput);
			}
		});
	});

	$('#selOutputs').change(function() {
		var outputs = midiAccess.outputs;
		outputs.forEach(function(port) {
			if (port.id === $('#selOutputs :selected').val()) {
				selectedOutput = port;
			}
		});
	});

	// Listen for replace checkbox change
	$('#cbReplaceOnRest').change(function() {
		replaceOnRest = this.checked;
	});

	for (var i = 1; i < 17; i++) {
		$('#selInputChannel').append($('<option>').val(i).text(i));
		// $('#selOutputChannel').append($('<option>').val(i).text(i));
	};

	// Don't allow the space key to trigger buttons
	$('button').focus(function() {
        this.blur();
    });


	// Queue logic
	$('#btnPlay').mousedown(function(ev) {
		advanceQueue(ev.which);
	});

	$('#btnPlay').mouseup(function(ev) {
		finishAdvanceQueue(ev.which);
	});

	$('#btnReset').click(function() {
		position = -1;
		$('#queue tbody tr').removeClass('active');
	})

	$('#triggerZone').keydown(function(ev) {
		advanceQueue(ev.which);
		return false;
	});

	$('#triggerZone').keyup(function(ev) {
		finishAdvanceQueue(ev.which);
		return false;
	});

	$('#triggerZone').keypress(function () {
		return false;
	});

	$('#btnClear').click(clearQueue);
	$('#btnUndo').click(removeFromQueue);
	$('#btnAddLast').click(function() { addToQueue(true); });
	$('#btnPreview, #btnAddLast').mousedown(startPreviewNotes).mouseup(endPreviewNotes);

	$(document).on('click', '.remove-sequence', function() {
		removeFromQueue($(this).data('position'));
	});

	key('command+z, ctrl+z', removeFromQueue);

	window.beforeunload = function() {
		stopAllOutput();
	}
});

// When MIDI access is requested this function is run.
function initMIDI(access) {
	midiAccess = access;
	showMIDIPorts();
	midiAccess.onstatechange = showMIDIPorts;
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
		else first = false;
		if (!_.contains(_.pluck($('#selOutputs option'), 'value'), port.id)) {
			$('#selOutputs').append($('<option>').val(port.id).text(port.manufacturer + " " + port.name));
		}
	});

	if (inputs.length === 0) alert('No inputs are available! :(');
	else hookUpMIDI(selectedInput);
	if (outputs.length === 0) alert('No outputs are available! :(');
}

// Hooks up one MIDI port and unhooks all the others.
function hookUpMIDI(port) {
	for (var input of midiAccess.inputs.values())
		input.onmidimessage = null;
	port.onmidimessage = midiMessageReceived;
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
      noteOff(noteNumber, channel);
    } else if (cmd === 9) { // note on
      noteOn(noteNumber, velocity, channel);
    } else if (cmd === 11) { // controller message
      //controller(noteNumber, velocity);
    }
}

// When a note is ON, this function will execute
function noteOn(noteNumber, velocity, channel) {
	// Log the note
	logNote(true, noteNumber, velocity, channel);

	if ($('#cbUseChannelFiltering').prop('checked') && channel.toString() !== $('#selInputChannel :selected').val()) return;

	var note = {number: noteNumber, velocity: velocity};

	// Clear the queue if we're replacing notes on rest
	if (replaceOnRest) {
		lastQueue = [];
		replaceOnRest = false;
	}

	// If the note is already in the queue (same number) don't include it
	if (!_.findWhere(lastQueue, {number: note.number})) lastQueue.push(note);

	// Preview the note
	previewQueue.push(note);
	if (selectedOutput) selectedOutput.send([0x90, note.number, $('#cbFixedVelocity').prop('checked') ? 127 : note.velocity]);

	// Display it on the output
	$('#lastQueue tr td').remove();
	$.each(lastQueue, function(i, _note) {
		$('#lastQueue tr').append($('<td>').text(_note.number + ', ' + _note.velocity));
	});
}

// When a note is OFF, this function will execute
function noteOff(noteNumber, channel) {
	// Log the note
	logNote(false, noteNumber, 0, channel);

	// Remove it from the preview queue
	previewQueue = _.filter(previewQueue, function(note) {
		return note.number !== noteNumber;
	});

	if (selectedOutput) selectedOutput.send([0x90, noteNumber, 0]);

	if (previewQueue.length === 0) {
		// Shut off the envelope
		if ($('#cbEagerInput').prop('checked')) {
			// If there are no notes being played right now, add the last played notes to the queue
			addToQueue();
		} else if ($('#cbReplaceOnRest').prop('checked')) {
			// we need to set replaceOnRest again since the next note will be cleared out
			replaceOnRest = true;
		}
	}
}

// Adds a series of notes to the cannon
function addToQueue(keepQueue) {
	if (lastQueue.length <= 0) return;
	queue.push(lastQueue);
	var last = queue.length - 1;
	var longest = $('#queue th').length - $('#queue th.header').length;
	var next = $('#queue tbody tr').length + 1;
	var toAdd = lastQueue.length - longest;

	// fill out the rest of the headers with <th>'s if more notes are played than the longest chord we've heard
	if (lastQueue.length > longest) {
		for (var i = 1; i < toAdd + 1; i++) {
			$('#queue thead tr').append($('<th>').text('Note #' + (longest + i)));
			$('#queue tbody tr').append($('<td>'));
		}
	}

	var row = $('<tr>');
	row.append($('<td>').addClass('remove-sequence').data('position', last).text('x').attr('title', 'Remove from sequence'));
	row.append($('<td>').text(next));
	$.each(lastQueue, function(i, note) {
		row.append($('<td>').text(note.number + ', ' + note.velocity));
	});

	// fill out the rest of the row with empty <td>'s if necessary
	if (toAdd * -1 > 0) {
		for (var i = 0; i < toAdd * -1; i++) {
			row.append($('<td>'));
		}
	}

	$('#queue tbody').append(row);

	// unless flag is set, remove the current queue
	if (!keepQueue) {
		$('#lastQueue tr td').remove();
		$('#lastQueue tr').append($('<td>').text('None'));
		lastQueue = [];
	}

	// scroll to note when added
	var queueBox = $('#box');
	var scrollTo = $('#queue tbody tr:last-child');
	queueBox.scrollTop(scrollTo.offset().top - queueBox.offset().top + queueBox.scrollTop());
}

// "Undo" functionality
function removeFromQueue(pos) {
	if (null === pos || undefined === pos) pos = queue.length - 1;
	queue.splice(pos, 1);
	redrawQueue();
	// TODO: remove empty columns
}

// Resets the cannon
function clearQueue() {
	queue = [];
	lastQueue = [];
	previewQueue = [];
	position = -1;
	keyPositions = {}; // ??? does this have to do with TODO below?
	// TODO: stop playing all notes still playing
	$('#queue thead th:not(.header), #queue tbody tr').remove();
}

// Advances the cannon's position by one and sends out the start of a note
function advanceQueue(keyCode) {
	var longest = $('#queue tbody tr').length;
	if ((longest === 0) || (null !== keyPositions[keyCode] && undefined !== keyPositions[keyCode])) return;
	if (position < 0 || position === longest - 1) position = 0;
	else position++;
	keyPositions[keyCode] = position;

	$('#queue tbody tr').removeClass('active');
	$($('#queue tbody tr')[position]).addClass('active');

	// scroll to note being played
	var queueBox = $('#box');
	var scrollTo = $('#queue tbody tr.active');
	queueBox.scrollTop(scrollTo.offset().top - queueBox.offset().top + queueBox.scrollTop());

	var notes = queue[position];
	$.each(notes, function(i, note) {
		selectedOutput.send([0x90, note.number, $('#cbFixedVelocity').prop('checked') ? 127 : note.velocity]);
	});
}

// Finishes advancing the cannon's position and sends the end of the note
function finishAdvanceQueue(keyCode) {
	var longest = $('#queue tbody tr').length;
	if (longest === 0) return;
	if (keyCode > 0 && keyCode < 4) {
		// mouse: since it doesn't play well with keyboard, silence everything
		var allActiveNotes = [];
		$.each(_.values(keyPositions), function(i, p) {
			allActiveNotes.push.apply(allActiveNotes, _.pluck(queue[p], 'number'));
		});

		$.each(allActiveNotes, function(i, note) {
			selectedOutput.send([0x90, note, 0]);
		});
		keyPositions = {};
	} else {
		var pos = (null !== keyPositions[keyCode] && undefined !== keyPositions[keyCode]) ? keyPositions[keyCode] : position;

		var notes = queue[pos];
		delete keyPositions[keyCode];
		
		// get big list of all notes in keyPositions still, don't turn any of those off
		var stillActiveNotes = [];
		$.each(_.values(keyPositions), function(i, p) {
			stillActiveNotes.push.apply(stillActiveNotes, _.pluck(queue[p], 'number'));
		});

		$.each(notes, function(i, note) {
			if (!_.contains(stillActiveNotes, note.number)) selectedOutput.send([0x90, note.number, 0]);
		});
	}
}

// It may be best at times to completely redraw the queue such as after deleting rows
function redrawQueue() {
	var longest = 0;
	var toAdd = $('#queue th').length - $('#queue th.header').length;

	// clear queue table
	$('#queue thead th:not(.header), #queue tbody tr').remove();

	// fill out the rest of the headers with <th>'s
	for (var i = 1; i < toAdd + 1; i++) {
		$('#queue thead tr').append($('<th>').text('Note #' + (longest + i)));
		$('#queue tbody tr').append($('<td>'));
	}

	$.each(queue, function(c, sequence) {
		var row = $('<tr>');
		row.append($('<td>').addClass('remove-sequence').data('position', c).text('x').attr('title', 'Remove from sequence'));
		row.append($('<td>').text(c + 1));
		$.each(sequence, function(i, note) {
			row.append($('<td>').text(note.number + ', ' + note.velocity));
		});

		// fill out the rest of the row with empty <td>'s if necessary
		if (toAdd * -1 > 0) {
			for (var i = 0; i < toAdd * -1; i++) {
				row.append($('<td>'));
			}
		}

		$('#queue tbody').append(row);
	});
}

// Preview notes
function startPreviewNotes() {
	$.each(lastQueue, function(i, note) {
		selectedOutput.send([0x90, note.number, $('#cbFixedVelocity').prop('checked') ? 127 : note.velocity]);
	});
}
// Preview notes
function endPreviewNotes() {
	$.each(lastQueue, function(i, note) {
		selectedOutput.send([0x90, note.number, 0]);
	});
}

// Log note to the MIDI monitor
function logNote(pressed, noteNumber, velocity, channel) {
	onOrOff = pressed ? 'ON: ' : 'OFF: ';
	$('#monitor').append($('<div>').addClass(pressed ? 'note-on' : 'note-off').text(onOrOff + noteNumber + (pressed ? ',' + velocity : '') + ', CH: ' + channel));
	$('#monitor').scrollTop($('#monitor')[0].scrollHeight);
}