"use strict";

//
//  batchRecord.js
//
//  Horrible Hack, please do not judge me.
//

(function () {


    var GOOGLE_SHEET_URL = "https://script.googleusercontent.com/a/macros/highfidelity.io/echo?user_content_key=z30W_Z9rqfb41pGEoxCkUM9yv8ZN8mxWuMyDWUHroj3cJ65OTSWNE_Zq7wvrTybnnFtRp6azMkya2K4Hj_UvG2HA9j2tP4Hjm5_BxDlH2jW0nuo2oDemN9CCS2h10ox_nRPgeZU6HP_Ok_bZ6q4uc2IEwUGUhs3tubd_SaoYEJGc6Y4WQVrmGLClD6RzMAfZPxqtsdMQ32tpzl66ygAELl7JpluoKw78VudcD_Dja5DuJzk35EV1vQ&lib=MzB5vcFo1OT_VNOUwG7287OYoCQvnAuFY";

    // helper function to wrap an HTTP get request.
    function XHR(url, successCb, failureCb, TIMEOUT) {
        print("XHR: request url = " + url);
        var self = this;
        this.url = url;
        this.successCb = successCb;
        this.failureCb = failureCb;
        this.req = new XMLHttpRequest();
        this.req.open("GET", url, true);
        this.req.timeout = TIMEOUT;
        this.req.ontimeout = function () {
            if (self.failureCb) {
                self.failureCb(0, "timeout");
            }
        };
        this.req.onreadystatechange = function () {
            if (self.req.readyState === self.req.DONE) {
                if (self.req.status === 200 || self.req.status === 203) {
                    if (self.successCb) {
                        self.successCb(self.req.responseText);
                    }
                } else {
                    if (self.failureCb) {
                        self.failureCb(self.req.status, "done");
                    }
                }
            }
        };
        this.req.send();
    }

    // this will contain the contents of the google spreadsheet.
    var TABLE = {};

    function sheetSuccess(response) {
        log("sheetSuccess status, response = " + response);
        TABLE = JSON.parse(response);
        TABLE.shift();  // strip off the header row.
    }

    function sheetFailure(status, reason) {
        log("sheetFailure status code = " + status + ", reason = " + reason);
    }

    // asynchronously start downloading the spreadsheet.
    var sheetXHR = new XHR(GOOGLE_SHEET_URL, sheetSuccess, sheetFailure);

    function baseName(str) {
        var base = new String(str).substring(str.lastIndexOf('/') + 1);
        if (base.lastIndexOf(".") !== -1) {
            base = base.substring(0, base.lastIndexOf("."));
        }
        return base;
    }

    var APP_NAME = "BATCHREC",
        APP_ICON_INACTIVE = "icons/tablet-icons/avatar-record-i.svg",
        APP_ICON_ACTIVE = "icons/tablet-icons/avatar-record-a.svg",
        SHORTCUT_KEY = "r",  // Alt modifier is assumed.
        tablet,
        button,

        RecordingIndicator,
        Recorder;

    function log(message) {
        print(APP_NAME + ": " + message);
    }

    RecordingIndicator = (function () {
        // Displays "recording" overlay.

        var hmdOverlay,
            HMD_FONT_SIZE = 0.08,
            desktopOverlay,
            DESKTOP_FONT_SIZE = 24;

        function show() {
            // Create both overlays in case user switches desktop/HMD mode.
            var screenSize = Controller.getViewportDimensions(),
                recordingText = "REC",  // Unicode circle \u25cf doesn't render in HMD.
                CAMERA_JOINT_INDEX = -7;

            if (HMD.active) {
                // 3D overlay attached to avatar.
                hmdOverlay = Overlays.addOverlay("text3d", {
                    text: recordingText,
                    dimensions: { x: 100 * HMD_FONT_SIZE, y: HMD_FONT_SIZE * 5 },
                    parentID: MyAvatar.sessionUUID,
                    parentJointIndex: CAMERA_JOINT_INDEX,
                    localPosition: { x: 0.95, y: 0.95, z: -2.0 },
                    color: { red: 255, green: 0, blue: 0 },
                    alpha: 0.9,
                    lineHeight: HMD_FONT_SIZE,
                    backgroundAlpha: 0,
                    ignoreRayIntersection: true,
                    isFacingAvatar: true,
                    drawInFront: true,
                    visible: true
                });
            } else {
                // 2D overlay on desktop.
                desktopOverlay = Overlays.addOverlay("text", {
                    text: recordingText,
                    width: 100 * DESKTOP_FONT_SIZE,
                    height: DESKTOP_FONT_SIZE * 5,
                    x: DESKTOP_FONT_SIZE,
                    y: DESKTOP_FONT_SIZE,
                    font: { size: DESKTOP_FONT_SIZE },
                    color: { red: 255, green: 8, blue: 8 },
                    alpha: 1.0,
                    backgroundAlpha: 0,
                    visible: true
                });
            }
        }

        function hide() {
            if (desktopOverlay) {
                Overlays.deleteOverlay(desktopOverlay);
            }
            if (hmdOverlay) {
                Overlays.deleteOverlay(hmdOverlay);
            }
        }

        function updateCaption(text) {
            if (desktopOverlay) {
                Overlays.editOverlay(desktopOverlay, {text: text});
            }
            if (hmdOverlay) {
                Overlays.editOverlay(hmdOverlay, {text: text});
            }
        }

        return {
            show: show,
            hide: hide,
            updateCaption: updateCaption
        };
    }());

    Recorder = (function () {
        var IDLE = 0,
            COUNTING_DOWN = 1,
            RECORDING = 2,
            recordingState = IDLE;

        function isRecording() {
            return recordingState === COUNTING_DOWN || recordingState === RECORDING;
        }

        function startRecording() {
            if (recordingState !== IDLE) {
                return;
            }

            Recording.startRecording();
            RecordingIndicator.show();
            recordingState = RECORDING;
        }

        function cancelRecording() {
            log("Cancel recording");
            Recording.stopRecording();
            RecordingIndicator.hide();
            recordingState = IDLE;
        }

        function finishRecording(filename) {
            Recording.stopRecording();
            RecordingIndicator.hide();
            filename = Recording.getDefaultRecordingSaveDirectory() + filename;
            log("Finish recording: " + filename);
            Recording.saveRecording(filename);
            recordingState = IDLE;
        }

        function stopRecording(filename) {
            if (recordingState === COUNTING_DOWN) {
                cancelRecording();
            } else if (recordingState === RECORDING) {
                finishRecording(filename);
            }
        }

        function setUp() {
        }

        function tearDown() {
            if (recordingState !== IDLE) {
                cancelRecording();
            }
        }

        return {
            isRecording: isRecording,
            startRecording: startRecording,
            stopRecording: stopRecording,
            setUp: setUp,
            tearDown: tearDown
        };
    }());

    // constructor
    function MetaRecorder() {
        this._recording = false;
    }

    MetaRecorder.prototype.startRecording = function () {
        this._recording = true;
        this._avatarIndex = 0;
        this.recordNext();
    };

    MetaRecorder.prototype.recordNext = function () {

        log("MetaRecorder.recordNext()");

        var self = this;
        var RECORDING_LENGTH = 3000;  // 3 seconds

        if (self._avatarIndex === TABLE.length) {
            // DONE!
            MyAvatar.skeletonModelURL = "";  // go back to the default avatar to indicate done.
            this._recording = false;
            button.editProperties({ isActive: metaRecorder.isRecording() });
            return;
        }

        var avatarURL = TABLE[self._avatarIndex].avatar_FST;
        var recordingURL = TABLE[self._avatarIndex].avatar_HFR;

        self._avatarIndex++;
        MyAvatar.skeletonModelURL = avatarURL;

        log("skeletonModelURL = " + avatarURL);

        this._loadCompleteCb = function () {

            log("loadComplete = " + avatarURL);

            if (MyAvatar.skeletonModelURL === avatarURL) {

                log("startRecording = " + avatarURL);

                Recorder.startRecording();

                log("before basename");

                log("basename = " + baseName(avatarURL));

                RecordingIndicator.updateCaption(baseName(avatarURL) + " -> " + baseName(recordingURL));
                Script.setTimeout(function () {

                    log("stopRecording = " + avatarURL + ", recordingURL = " + baseName(recordingURL) + ".hfr");

                    Recorder.stopRecording(baseName(recordingURL) + ".hfr");
                    MyAvatar.onLoadComplete.disconnect(self._loadCompleteCb);
                    self.recordNext();
                }, RECORDING_LENGTH);
            }
        };
        MyAvatar.onLoadComplete.connect(this._loadCompleteCb);
    };

    MetaRecorder.prototype.isRecording = function () {
        return this._recording;
    };

    var metaRecorder = new MetaRecorder();

    function toggleRecording() {

        if (metaRecorder.isRecording()) {
            // do nothing.
        } else {
            log("MetaRecorder.startRecording()");
            metaRecorder.startRecording();
        }

        button.editProperties({ isActive: metaRecorder.isRecording() });
    }

    function onKeyPressEvent(event) {
        if (event.isAlt && event.text === SHORTCUT_KEY && !event.isControl && !event.isMeta && !event.isAutoRepeat) {
            toggleRecording();
        }
    }

    function onButtonClicked() {
        toggleRecording();
    }

    function setUp() {
        tablet = Tablet.getTablet("com.highfidelity.interface.tablet.system");
        if (!tablet) {
            return;
        }

        Recorder.setUp();

        // tablet/toolbar button.
        button = tablet.addButton({
            icon: APP_ICON_INACTIVE,
            activeIcon: APP_ICON_ACTIVE,
            text: APP_NAME,
            isActive: false
        });
        if (button) {
            button.clicked.connect(onButtonClicked);
        }

        Controller.keyPressEvent.connect(onKeyPressEvent);
    }

    function tearDown() {

        Controller.keyPressEvent.disconnect(onKeyPressEvent);

        Recorder.tearDown();

        if (!tablet) {
            return;
        }

        if (button) {
            button.clicked.disconnect(onButtonClicked);
            tablet.removeButton(button);
            button = null;
        }

        tablet = null;

    }

    setUp();
    Script.scriptEnding.connect(tearDown);
}());