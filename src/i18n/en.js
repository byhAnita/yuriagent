export default {
  app: { title: 'YuriAgent', tagline: 'X Entertainment' },

  start: {
    blurb: 'You work for them. That is the whole of your access, and it is more than most people get.',
    nameLabel: 'Your name',
    namePlaceholder: 'What they call you',
    nameNote: 'Narration will always say "you". Only they use your name.',
    identityLabel: 'Who you are',
    castLabel: 'X',
    castFixed: 'five, fixed',
    customCast: 'Build your own five',
    soon: 'soon',
    begin: 'Begin',
    savedAt: '{name}, week {week}, day {day}',
    beginOver: 'Start over',
  },

  save: {
    open: 'Save',
    title: 'Saves',
    pick: 'Pick a slot to write this day into.',
    slot: 'Slot {n}',
    auto: 'Auto',
    autoNote: 'Writes itself at the start of every day',
    empty: 'Empty',
    focus: 'closest to {member}',
    saveHere: 'Save here',
    load: 'Load',
    delete: 'Delete',
    confirmOverwrite: 'Tap again to overwrite',
    confirmDelete: 'Tap again to delete',
    failed: 'Could not write it. Storage may be full or blocked.',
    close: 'Close',
    onlyAtDayStart: 'You can save between days, not inside a scene.',
  },

  identity: {
    assistant: 'Artist Assistant',
    manager: 'Group Manager',
    producer: 'Producer',
    idol: 'Sixth Member',
  },

  identityNote: {
    assistant: 'You carry the bags and know the schedule. Nobody looks twice at you, which is the job and the opportunity.',
    manager: 'You decide where they go. Everything you do is on the record.',
    producer: 'You are in the room where the work is made, and almost nowhere else.',
    idol: 'You are one of them. Every hour of your day is theirs too.',
  },

  /**
   * Anchor events. Titles and blurbs only - the frame the model reads is
   * model-facing English in `data/events/` and never localized (section 19).
   */
  handbook: {
    title: "Notes",
    close: "close",
    cycle: "Cycle",
    empty: "Nothing has been decided yet. What the group settles at a meeting, a shoot or a broadcast gets written down here.",
    open: "notes",
  },

  event: {
    today: 'Today is',
    wholeDay: 'It takes the whole day.',
    concept_meeting: 'Concept Meeting',
    concept_meetingBlurb: 'The comeback gets decided in one room, in one afternoon.',
    mv_shoot: 'MV Shoot',
    mv_shootBlurb: 'A closed set, a long day, and the concept made real.',
    music_bank: 'Music Bank',
    music_bankBlurb: 'Fourteen hours for three minutes of stage.',
    fan_meeting: 'Fan Meeting',
    fan_meetingBlurb: 'Four hours of being warm to nine hundred strangers.',
    company_cruise: 'Company Cruise',
    company_cruiseBlurb: 'Compulsory fun with the people you work for.',
    island_trip: 'Island Day',
    island_tripBlurb: 'The first day in nine weeks with nothing scheduled on it.',
  },

  /**
   * The dorm's own group scenes. The frame the model reads is model-facing
   * English in `data/sharedActivities.js` and never localized (section 19).
   */
  shared: {
    note: 'All of you. Nobody is being singled out.',
    cook_together: 'Cook together',
    watch_a_film: 'Watch something together',
  },

  /**
   * The endings. Section 5.
   *
   * Each has a NAME and a LINE. The line is what the screen actually says
   * about her, and it is authored rather than generated on purpose: it is the
   * last thing the player reads, it has to be exactly right, and a summarizer
   * call at that moment could fail and leave the campaign ending in silence.
   */
  ending: {
    out_end: 'Out',
    out_endLine: 'Said out loud, to anyone who asked. It cost what it was always going to cost, and neither of you would take it back.',
    ours_end: 'Ours',
    ours_endLine: 'Named, and kept between the two of you. Everybody suspects; nobody is told.',
    unspoken_end: 'Unspoken',
    unspoken_endLine: 'Both of you know. Neither of you has ever had to say it, and by now saying it would almost be a step backwards.',
    unnamed_end: 'No Word For It',
    unnamed_endLine: 'As close as two people get, and there was never a word that fit. Not broken - just never named.',
    confidante_end: 'Confidante',
    confidante_endLine: 'She tells you everything. It never became anything else, and somewhere along the way it stopped being able to.',
    friends_end: 'Friends',
    friends_endLine: 'Genuinely fond of you. That is where it settled, and it is not nothing.',
    reckless_end: 'Reckless',
    reckless_endLine: 'Public, and hollow. You made it visible long before it was real, and it is still not real.',
    drift_end: 'Drift',
    drift_endLine: 'You worked together for nine weeks. It never started.',
    nameless_end: 'A Friend',
    nameless_endLine: 'You got so close. She has decided what you are to her, and it is a friend, and she will not be revisiting it.',
    exposure_end: 'Seen',
    exposure_endLine: 'It got out. The company moved first, the fandom moved second, and neither of you was consulted.',
    severance_end: 'Severance',
    severance_endLine: 'She stopped answering. Whatever it had become, she could not carry it any further.',
  },

  endings: {
    title: 'Nine weeks',
    subtitle: 'How it ended, with each of them.',
    balance: 'All five, and not one of them named it.',
    balanceNote: 'The hardest thing this game asks for.',
    good: 'Something real',
    neutral: 'Where it settled',
    bad: 'How it broke',
    again: 'Again',
  },

  settings: {
    title: 'Settings',
    theme: 'Theme',
    fontSize: 'Text size',
    language: 'Language',
    reduceMotion: 'Reduce motion',
    writtenChips: 'Written options',
    model: 'Model',
    apiKey: 'API key',
    saveKey: 'Save',
    clearKey: 'Clear',
    keyOn: 'Key stored on this device only. Never sent anywhere but the model endpoint.',
    keyOff: 'No key. Running the offline demo writer.',
    on: 'On',
    off: 'Off',
  },

  theme: {
    night: 'Night',
    day: 'Day',
    dusk: 'Dusk',
    bloom: 'Bloom',
    bloomHint: 'Takes its colour from whoever you are closest to.',
  },

  phase: { prep: 'Preparation', comeback: 'Comeback', rest: 'Rest' },
  block: { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' },
  day: { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' },
  /**
   * The same seven days, at full length, for the day header.
   *
   * Separate from `day` because that one lives in a seven-column calendar grid
   * at 390px and has to stay one or two characters wide in every locale. The
   * header has room, and `D5` was arithmetic the player had to do to find out
   * whether the weekend was close.
   */
  dayFull: {
    mon: 'Monday',
    tue: 'Tuesday',
    wed: 'Wednesday',
    thu: 'Thursday',
    fri: 'Friday',
    sat: 'Saturday',
    sun: 'Sunday',
  },

  stage: {
    stranger: 'Stranger',
    colleague: 'Colleague',
    good_friends: 'Very good friends',
    nameless: 'Nameless',
    unspoken: 'Unspoken',
    ours: 'Ours',
    out: 'Out',
    confidante: 'Confidante',
    confidanteHint: 'stalled; needs to be seen',
    reckless: 'Reckless',
  },

  jealousy: { calm: 'Calm', piqued: 'Piqued', sharp: 'Sharp', corrosive: 'Corrosive' },

  /**
   * Where you stand, in words. PROPOSALS 25.
   *
   * Deliberately NOT the STANDING table in `agent/promptBuilder.js`. That one
   * is model-facing English that never localizes, written in the third person
   * for something being asked to write her. This is the player's own screen,
   * in the player's own language, in the second person - and the two are
   * allowed to drift, because they are addressed to different readers.
   */
  standing: {
    stranger: '{name} barely knows you yet.',
    colleague: '{name} knows you as a colleague, and not much more.',
    good_friends: '{name} is easy around you, and calls it friendship.',
    nameless: '{name} is close to you in a way neither of you has put a name to.',
    unspoken: '{name} knows exactly what this is. Neither of you has said it out loud.',
    ours: '{name} is with you, privately, and you both know it.',
    out: '{name} is with you and has stopped hiding it.',
    confidante: '{name} trusts you completely in private and keeps a careful distance in public.',
    reckless: 'You are further out in the open with {name} than the two of you are ready for.',
  },

  strain: { stable: 'steady', tense: 'tense', rift: 'a rift', critical: 'breaking' },

  relations: {
    open: 'where you stand',
    title: 'Where you stand',
    close: 'How close',
    dismiss: 'close',
    nameable: 'How nameable',
    /**
     * The same two axes on the scene strip, where the whole line is one row and
     * both labels sit inline with their rails. The panel can afford a sentence;
     * a 390px strip carrying two axes cannot.
     */
    closeShort: 'close',
    nameableShort: 'nameable',
    jealousy: 'jealousy',
    strain: 'strain',
    lede: 'Two numbers, not one. Closeness grows anywhere; being nameable only grows where you can be seen.',
    stalled: 'Stalled. She will not get any closer until the two of you have been seen together, doing something neither of you could deny.',
  },


  exposureBand: { private: 'private', quiet: 'quiet', public: 'seen' },

  role: {
    leader: 'Leader',
    maknae: 'Maknae',
    visual: 'Visual',
    main_dancer: 'Main Dancer',
    lead_dancer: 'Lead Dancer',
    main_vocalist: 'Main Vocalist',
    lead_vocalist: 'Lead Vocalist',
    sub_vocalist: 'Sub Vocalist',
    main_rapper: 'Main Rapper',
    lead_rapper: 'Lead Rapper',
    sub_rapper: 'Sub Rapper',
  },

  location: {
    practice_room: 'X Practice Room',
    wardrobe: 'Wardrobe Room',
    corridor: 'X Entertainment Corridor',
    drama_set: 'Filming Location',
    cafe: 'Cafe',
    broadcast_studio: 'Broadcast Studio',
    drink_room: 'Canteen & Drink Room',
    bistro: 'Bistro',
    meeting_room: 'X Meeting Room',
    makeup_room: 'Make-up Room',
    green_room: 'Green Room',
    mv_set: 'MV Set',
    music_bank: 'Music Bank Studio',
    fan_meeting_hall: 'Fan Meeting Hall',
    photo_studio: 'Photo Studio',
    hair_salon: 'Hair Salon',
    han_river: 'Han River Park',
    cruise: 'Company Cruise',
    island: 'Jeju',
    dorm_living: 'Dorm - Living Room',
    dorm_kitchen: 'Dorm - Kitchen',
    dorm_room: 'Dorm - Bedroom',
    dorm_player_room: 'Your Room',
  },

  activity: {
    group_practice: 'Group practice',
    vocal_recording: 'Vocal recording',
    concept_meeting: 'Concept meeting',
    mv_shoot: 'MV shoot',
    fitting: 'Fitting',
    music_show: 'Music show',
    fan_signing: 'Fansign',
    variety_taping: 'Variety taping',
    drama_shoot: 'Drama shoot',
    script_reading: 'Script reading',
    solo_recording: 'Solo recording',
    tour_rehearsal: 'Tour rehearsal',
    photoshoot: 'Photoshoot',
    brand_event: 'Brand event',
    makeup_work: 'Makeup work',
    radio_host: 'Radio show',
    free: 'free',
    cafe_break: 'Out for coffee',
    dorm_rest: 'At the dorm',
    dorm_late: 'Up late',
    in_her_room: 'In her room',
    late_practice: 'Practising alone',
  },

  task: {
    prep_outfits: 'Have the stage outfits ready',
    run_schedule: 'Run the day schedule',
    handle_press_kit: 'Get the press kit out',
    stage_check: 'Check the stage setup',
    restock_wardrobe: 'Restock the wardrobe room',
  },

  map: {
    back: 'Back',
    dorm: 'X Dorm',
    doors: 'Their doors',
    herRoom: "{name}'s room",
    doorLocked: 'needs {n} closeness',
    notHome: 'not home',
    yourRoomNote: 'The only place that gives anything back.',
    task: 'Task',
    empty: 'nobody',
    seen: 'seen',
    witnesses: 'eyes',
    dormNote: 'The dorm hides you from the world, and from nobody who lives in it.',
    week: 'Week',
    close: 'Close',
    groupSlot: 'Group',
    soloSlot: 'Solo',
    free: 'Free',
    calendar: 'Week',
    settings: 'Settings',
  },

  game: {
    task: 'Today',
    taskDone: 'Done',
    doTask: 'Do the work',
    taskFailed: 'You never got to it.',
    energy: 'Energy',
    /** On the scene screen from v2 on: the numbers are visible (Part I.2). */
    mood: 'Mood',
    selfId: 'Sense of self',
    credits: 'Credits',
    competence: 'Standing',
    nextBlock: 'Move on',
    dayOver: 'End of day',
    newDay: 'Next day',
    campaignOver: 'The cycle is over',
    tooTired: 'Too tired for anything but sleep.',
  },

  gift: {
    title: 'Hand it over, or bring it up',
    who: 'To whom',
    generic: 'Something ordinary',
    knowledge: 'Something only you would know to bring',
    locked: 'learn more',
    hint: 'These open when she tells you something worth remembering.',
    skip: 'Not now',
    gesture: 'Say something only you would know to say',
    free: 'free',
    iced_coffee: 'Iced coffee',
    home_cooked: 'Something you cooked yourself',
    rose: 'A single rose',
    lozenges: 'Throat lozenges',
    snack_box: 'Convenience store haul',
    chicken_free_dinner: 'Dinner, with no chicken anywhere on it',
    mugwort_pack: 'A warm mugwort pack',
    cold_sikhye: 'An ice-cold sikhye',
    pink_plushie: 'The pink one she has been hunting',
    late_night_ramen: 'Late-night ramen, cooked for her',
    insulated_water_jug: 'A jug big enough for her',
    hot_takoyaki_box: 'A hot box of takoyaki',
    magical_girl_figure: 'The figure she is still missing',
  },

  gesture: {
    chicken_free_dinner: 'Order for both of you, with no chicken on the table',
    mugwort_pack: 'Warm her hands before she says they are cold',
    ask_about_softener: 'Ask which softener actually smells best',
    squats_together: 'Do a set of squats with her between runs',
    cold_sikhye: 'Bring her the cold one she actually wants',
    sing_the_duet: 'Put on her favourite song and take the harmony',
    invite_her_friends: 'Ask her to bring her friends round',
    haunted_house: 'Suggest the haunted house, and stay behind her',
    pink_plushie: 'Notice the pink thing she is quietly delighted by',
    wait_at_the_table: 'Stay at the table and talk while she finishes',
    balance_the_bottle: 'Hand her a bottle and wait, straight-faced',
    all_nighter_co_op: 'Propose an all-nighter on co-op',
    hide_the_newspapers: 'Threaten to hide the newspapers from her',
    speed_shopping_race: 'Race her round the shops, ten minutes flat',
    late_night_ramen: 'Offer to cook it for her, late, before the shoot',
    ask_her_to_do_yours: 'Ask her to do your face for once',
    insulated_water_jug: 'Remind her the jug is empty again',
    get_her_talking: 'Start her on something she loves and let her run',
    ask_for_a_vitamin: 'Ask her for something out of the pouch',
    hot_takoyaki_box: 'Turn up with takoyaki and refuse to explain',
    gear_second_pose: 'Greet her with the pose and commit to it',
    ask_for_the_flow: 'Ask her to do the rapper voice',
    a_long_hug: 'Hug her, and do not let go first',
    ask_her_to_shoot_you: 'Hand her your phone and ask for one of you',
    magical_girl_figure: 'Ask which one she had first',
  },

  solo: {
    alone: 'Nobody here',
    whoIsHere: 'Who is here',
    talkTo: 'Talk to {name}',
    joinThem: 'Join them',
    joinNote: 'All of them, and every one of them watching.',
    watched: 'The others are right there',
    secrecy: 'Discretion',
    mayLearn: 'you might find something',
    nothingHere: 'nothing here right now',
    learned: 'You learned something',
    heard: 'She has heard',
    learnedNothing: 'Nothing you did not already know.',
    learnedLine: '{name} {fact}.',
    prep_fittings: 'Get tomorrow to ready itself',
    prep_fittings_result: 'You steam, tag and hang until the rail is a day ahead of the schedule. Someone will notice. Probably not today.',
    read_fitting_notes: 'Read the fitting notes',
    read_fitting_notes_result: 'The margins are full of things nobody meant you to read. You put the folder back exactly where it was.',
    chase_schedule: 'Chase the day down',
    chase_schedule_result: 'Four calls and a corridor argument later, the afternoon exists again.',
    overhear: 'Take your time in the corridor',
    overhear_result: 'You are slow enough getting through the door that you hear the end of it.',
    run_setlist: 'Run the setlist alone',
    run_setlist_result: 'The room is loud and completely empty. You count them in anyway.',
    tidy_room: 'Put the room back',
    tidy_room_result: 'Water bottles, tape, someone hoodie. It takes twenty minutes and nobody will mention it.',
    help_crew: 'Make yourself useful to the crew',
    help_crew_result: 'You carry things, hold things and stay out of frame. The floor manager learns your name.',
    wait_on_set: 'Wait it out on set',
    wait_on_set_result: 'Setups are slow. You read the callsheet twice and learn how a scene gets made.',
    coffee_run: 'Buy the whole table coffee',
    coffee_run_result: 'Six drinks, two of them wrong, and nobody lets you pay next time.',
    sit_alone: 'Sit with your own coffee',
    sit_alone_result: 'You do nothing for an hour. It helps more than it should.',
    cook_a_dish: 'Cook something for later',
    cook_a_dish_result: 'You make more than you are going to eat, and put the rest in a box. Somebody is going to be glad of it.',
    cook_for_dorm: 'Cook enough for whoever comes in',
    cook_for_dorm_result: 'You leave it covered on the counter with a note. In the morning the pan is clean.',
    clean_up: 'Deal with the kitchen',
    clean_up_result: 'Someone has to. It is you again.',
    wait_up: 'Wait up in the living room',
    wait_up_result: 'People come in late and talk like you are furniture. You hear more that way.',
    sleep_it_off: 'Sleep',
    sleep_it_off_result: 'You go down hard and wake up almost human.',
    lie_awake: 'Lie awake and think about work',
    lie_awake_result: 'You do not sleep well, but you solve tomorrow at three in the morning.',
    watch_the_playback: 'Watch the practice playback back',
    watch_the_playback_result: 'Somebody left the camera rolling after the run. You watch further than you should, and learn something from the part where nobody was performing.',
    linger_green_room: 'Take the long way past the green room',
    linger_green_room_result: 'Doors here do not close properly and everyone is too busy to look up. You are past in ten seconds and carrying something you were not given.',
    read_call_sheet: 'Read the call sheet properly',
    read_call_sheet_result: 'Half of it is scheduling. The other half is somebody handwriting in the margin, and that half was not meant for you.',
    listen_in: 'Stay for another cup',
    listen_in_result: 'The next table is staff, and staff talk. You look at your phone the whole time.',
    read_the_fridge: 'Read what is stuck to the fridge',
    read_the_fridge_result: 'Notes, a rota nobody follows, and one thing written to somebody in particular. You read it twice.',
    read_the_run_order: 'Read the run order properly',
    read_the_run_order_result: 'Timings, camera blocks, and one handwritten line about who needs the long break. You put it back squared to the edge of the desk.',
    lay_out_the_kit: 'Lay the kit out before they arrive',
    lay_out_the_kit_result: 'Brushes down in order, the shades they actually use at the front. Nobody thanks you for it and the morning runs twenty minutes shorter.',
    read_the_face_charts: 'Read the face charts',
    read_the_face_charts_result: 'A year of notes on a face you see every day. Half of it is technical. The other half is not.',
    hold_the_reflector: 'Hold the reflector all afternoon',
    hold_the_reflector_result: 'Your arms give out before the light does. The photographer learns your name, which is worth something.',
    scroll_the_contact_sheet: 'Scroll back through the contact sheet',
    scroll_the_contact_sheet_result: 'Three hundred frames, and the four between the poses are the ones you keep looking at.',
    do_the_drinks_run: 'Do the drinks run for the floor',
    do_the_drinks_run_result: 'Eleven orders, none of them written down, all of them right. The room warms to you by exactly one degree.',
    linger_by_the_urn: 'Take your time by the urn',
    linger_by_the_urn_result: 'The water takes a while to boil, and staff talk in here as if the staff were not in here. You do not have to ask anything.',
    stock_the_green_room: 'Stock the green room before they come off',
    stock_the_green_room_result: 'Water, towels, the snacks they will actually eat. It is invisible work and it is noticed exactly once, by whoever finds it missing.',
    stay_by_the_monitors: 'Stay by the monitors a while',
    stay_by_the_monitors_result: 'Everyone in here is between takes with nothing to do but talk, and nothing to look at but you standing there.',
    sweep_the_floor: 'Sweep up between clients',
    sweep_the_floor_result: 'Hair, foil, a magazine somebody left open. The owner pays you in cash and does not ask why you are here.',
    wait_your_turn: 'Sit and wait your turn',
    wait_your_turn_result: 'Two hours in a chair with nothing to do but listen, and this is a room where people say things out loud.',
    work_the_tables: 'Pick up a shift on the floor',
    work_the_tables_result: 'Four hours, one broken glass, and an envelope at the end of it. Nobody here knows what you do the rest of the week.',
    clear_their_table: 'Clear the table they always take',
    clear_their_table_result: 'The corner booth, and what people leave behind on a table says more than what they said at it.',
    walk_it_off: 'Walk the river until it gets dark',
    walk_it_off_result: 'An hour of nothing, and nothing is what you needed. You come back with your shoulders down.',
    sit_on_the_steps: 'Sit on the steps a while',
    sit_on_the_steps_result: 'People come here to stop performing. You see one of them off duty for a moment, and it stays with you.',
  },

  /**
   * What she found out, for the PLAYER to read.
   *
   * The same event is stored in her dossier in English (section 19 rule 2:
   * memory is language-agnostic so the player can switch mid-run without
   * corrupting history). These are the display twin of those lines, and the
   * two must never be confused - printing the memory string put English into a
   * Chinese run, which is what this exists to stop.
   */
  rumorLine: {
    witnessed: '{name} saw you with {subject}.',
    approach: "{name} watched you go into {subject}'s room.",
    heard: '{name} heard you were at {where} with {subject}.',
    /* Presence, not hearsay. No dossier entry behind it - section 5b. */
    present: '{name} was in the room while you spent it on {subject}.',
  },

  date: {
    title: 'Ask someone out',
    note: 'It takes the whole day, and the others will notice you were gone.',
    skip: 'Not today',
    public: 'Take {name} out',
    private: "Spend the day in {name}'s room",
    heading: { public: 'Somewhere people can see', private: 'Somewhere nobody can' },
    chance: { sure: 'she would say yes', likely: 'she probably would', maybe: 'she might' },
    no: {
      not_close: 'you are not that close yet',
      not_nameable: 'not something she could be seen doing',
      strain: 'not while things are like this',
      jealousy: 'she is barely speaking to you',
      credits: 'you cannot cover it',
      declined: 'not today',
    },
    refused: {
      declined: '{name} thought about it, and said not this time.',
      not_close: '{name} was kind about it. Whatever the two of you are, it is not that yet.',
      not_nameable: '{name} would spend the day with you. Somewhere people could watch her do it is another question, and the answer today is no.',
      strain: '{name} said no before you had finished asking.',
      jealousy: '{name} did not even look up.',
      credits: 'You checked what you had, and put the idea away.',
    },
  },

  vn: {
    modelDown: 'Model unreachable - offline line',
    sayIt: 'Say something',
    send: 'Send',
    readHer: 'Read her',
    give: 'Give / bring up',
    turnTo: 'Turn to {name}',
    leave: 'Leave',
    thinking: '...',
    freeTextPlaceholder: 'What do you say?',
    enter: 'Enter',
    whoWhere: 'Who, and where',
    begin: 'Begin scene',
    offline: 'Offline demo',
    offlineNote: 'Plays without an API key. The writing is placeholder.',
    sceneOver: 'Scene over',
    /**
     * Zero is the normal answer (Part I.8), so this is not a failure notice and
     * must not read like one.
     */
    nothingMoved: 'An ordinary hour',
    again: 'Another scene',
    turnsLeft: 'left',
    outOfTurns: 'The block is over.',
    /**
     * When fewer than four options parsed. Deliberately contentless - these are
     * not a stance system in hiding, they are four ways to keep a conversation
     * moving, and the free-text box is right underneath either way.
     */
    fallback: {
      a: 'Say something back',
      b: 'Ask her about it',
      c: 'Let the silence run',
      d: 'Change the subject',
    },
  },

  dev: { scaffold: 'M0 scaffold', castLoaded: 'Cast', tokenCheck: 'Token check' },
};
