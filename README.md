# Note Cannon
Load and fire off a sequence of MIDI notes

[Live site](http://zshall.github.io/Note-Cannon/) (requires a web browser [capable of supporting Web MIDI](http://caniuse.com/#feat=midi) such as Google Chrome right now)

This is a work in progress and will change as I go along. The basic idea of this program is to make melodic sequencing easier by combining the precision of a step sequencer with the complexities of musical timing. Most good melodies aren't just one unbroken string of equally sized and toned notes, and rather contain rests, held notes, and complex melodies that are difficult to play if you're not a keyboard player. I'm not a keyboard player, and I wanted a way to make melodies as easy as drum sequencing (which can be equated more to steps on a grid than a piano or guitar).

This program lets you input, step by step, a sequence of notes and chords from a MIDI input device. They will be stored in a queue and will be able to be played back at a variable time. Whenever you press the "Play" button or tap on the keyboard, the next note in the queue will be played through the selected MIDI output device.

I'll put up some more information soon, but here's my plan for future features:

* Allow you to listen to the MIDI notes in the browser without needing a MIDI output device on the computer
* Allow you to input steps using a virtual MIDI keyboard in the browser
* **Multiple queues** each with their own channel, input, and output
* **Control multiple queues** and assign different keyboard keys to them at once
* Hold a note or chord while playing the next one with a different key
* Have a **performance mode** in which different octaves of a MIDI input device will be used to play back notes in various queues, complete with dynamic velocity and maybe CCs and foot pedals inputs.
* Allow you to press a foot pedal to add the currently played note to the queue as it is (in patient mode)
