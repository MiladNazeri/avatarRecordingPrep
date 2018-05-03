"use strict";

//
//  Hacked playRecordingAC.js
//

(function () {

    var APP_NAME = "PLAYBACK",
        ASSIGNMENT_MANAGER_CHANNEL = "ASSIGNMENT_MANAGER_CHANNEL",
        RECORDER_COMMAND_ERROR = "error",
        HIFI_PLAYER_CHANNEL = "HIFI_PLAYER_CHANNEL:" + Agent.sessionUUID,
        PLAYER_ACTION_PLAY = "play",
        PLAYER_ACTION_STOP = "stop",
        heartbeatTimer = null,
        HEARTBEAT_INTERVAL = 3000,
        TIMESTAMP_UPDATE_INTERVAL = 2500,
        AUTOPLAY_SEARCH_INTERVAL = 5000,
        AUTOPLAY_ERROR_INTERVAL = 30000,  // 30s
        scriptUUID,
        registerd = false,
        Player;

        var baseURL = "https://hifi-content.s3.amazonaws.com/milad/ROLC/Organize/Projects/Testing/Flow/out/hfr/";

    function log(message) {
        print(APP_NAME + " " + scriptUUID + ": " + message);
    }

    Player = (function () {
        // Recording playback functions.
        var userID = null,
            isPlayingRecording = false,
            recordingFilename = "",
            // autoPlayTimer = null,

            // autoPlay,
            playRecording;

        function error(message) {
            // Send error message to user.
            Messages.sendMessage(ASSIGNMENT_MANAGER_CHANNEL, JSON.stringify({
                command: RECORDER_COMMAND_ERROR,
                user: userID,
                message: message
            }));
        }

        function play(recording, position, orientation) {
            var errorMessage;

            recording = baseURL + recording + ".hfr";
            console.log("playing:", recording)

                orientation = orientation || Quat.IDENTITY;
                
                Recording.loadRecording(recording, function (success) {
                    var errorMessage;

                    if (success) {
                        console.log("success!!")
                        Users.disableIgnoreRadius();

                        Agent.isAvatar = true;
                        Avatar.position = position;
                        Avatar.orientation = orientation;

                        Recording.setPlayFromCurrentLocation(true);
                        Recording.setPlayerUseDisplayName(true);
                        Recording.setPlayerUseHeadModel(false);
                        Recording.setPlayerUseAttachments(true);
                        Recording.setPlayerLoop(true);
                        Recording.setPlayerUseSkeletonModel(true);

                        Recording.setPlayerTime(0.0);
                        Recording.startPlaying();

                        UserActivityLogger.logAction("playRecordingAC_play_recording");
                    } else {
                        errorMessage = "Could not load recording " + recording.slice(4);  // Remove leading "atp:".
                        console.log("errorMessage!!")
                        
                        log(errorMessage);
                        error(errorMessage);

                        isPlayingRecording = false;
                        recordingFilename = "";

                    }
                });
            };

        function stop() {
            log("Stop playing " + recordingFilename);
            if (Recording.isPlaying()) {
                Recording.stopPlaying();
                Agent.isAvatar = false;
            }
            isPlayingRecording = false;
            recordingFilename = "";
        }

        function isPlaying() {
            return isPlayingRecording;
        }

        function recording() {
            return recordingFilename;
        }

        return {
            play: play,
            stop: stop,
            isPlaying: isPlaying,
            recording: recording,
        };
    }());

    function sendHeartbeat() {
        Messages.sendMessage(HIFI_PLAYER_CHANNEL, JSON.stringify({
            playing: Player.isPlaying(),
            recording: Player.recording()
        }));
    }

    function onHeartbeatTimer() {
        sendHeartbeat();
        heartbeatTimer = Script.setTimeout(onHeartbeatTimer, HEARTBEAT_INTERVAL);
    }

    function startHeartbeat() {
        onHeartbeatTimer();
    }

    function stopHeartbeat() {
        if (heartbeatTimer) {
            Script.clearTimeout(heartbeatTimer);
            heartbeatTimer = null;
        }
    }

    function onMessageReceived(channel, message, sender) {
        // console.log("channel", channel)
        // console.log("message", message)
        // console.log("sender", sender)
        
        
        message = JSON.parse(message);
        if (channel === ASSIGNMENT_MANAGER_CHANNEL) {
            switch (message.action){
                case "GET_HEARTBEAT":
                    console.log(scriptUUID + "Received Get heart beat");
                    
                    sendHeartbeat();
                    break;
                case "GET_UUID":
                    console.log(scriptUUID + "Received Get UUID");
                    
                    if (registerd === false) {
                        Messages.sendMessage(ASSIGNMENT_MANAGER_CHANNEL, JSON.stringify({
                            action: "REGISTER_ME",
                            uuid: scriptUUID
                        }));
                    }
                    break;
                default:
                    break;
            }
        }

        if (channel === HIFI_PLAYER_CHANNEL){
                switch (message.action) {
                case "REGISTERATION ACCEPTED":
                    console.log(scriptUUID + "UUID REGISTERATION ACCEPTED");
                    registerd = true;
                    break;
                case PLAYER_ACTION_PLAY:
                    console.log("PLAYING: ", JSON.stringify(message) );
                    if (!Player.isPlaying()) {
                        Player.play(message.recording, message.position, message.orientation);
                    } else {
                        log("Didn't start playing " + message.recording + " because already playing " + Player.recording());
                    }
                    sendHeartbeat();
                    break;
                case PLAYER_ACTION_STOP:
                    Player.stop();
                    sendHeartbeat();
                    break;
                }
            }
    }

    function setUp() {
        scriptUUID = Agent.sessionUUID;
        console.log(scriptUUID + "setUp");
        
        Messages.messageReceived.connect(onMessageReceived);
        Messages.subscribe(HIFI_PLAYER_CHANNEL);
        Messages.subscribe(ASSIGNMENT_MANAGER_CHANNEL);
    
        startHeartbeat();

        UserActivityLogger.logAction("playRecordingAC_script_load");
    }

    function tearDown() {
        stopHeartbeat();
        Player.stop();

        Messages.messageReceived.disconnect(onMessageReceived);
        Messages.unsubscribe(HIFI_PLAYER_CHANNEL);
    }

    setUp();
    Script.scriptEnding.connect(tearDown);

}());
