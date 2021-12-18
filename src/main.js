/**
 * 赤ちゃんの便秘BOT
 */
const LINE_CHANNEL_TOKEN = '*****'; // LINE NOTIFYのアクセストークン
const SSID = '*****';
const SSN_USER = 'user';
const SSN_HISTORY = 'history';
const DAY_TIME = 1000 * 60 * 60 * 24;

let spreadsheet = SpreadsheetApp.openById(SSID);
let userSheet = spreadsheet.getSheetByName(SSN_USER);
let historySheet = spreadsheet.getSheetByName(SSN_HISTORY);

/**
 * POSTリクエスト
 * @param {Object} event 
 */
function doPost(event) {
    try {
        if (event.postData) {
            let reqObj = JSON.parse(event.postData.contents);
            execute(reqObj);
        }
    } catch (e) {
        console.error(e.stack);
    }
}

/**
 * イベント処理
 * @param {Object} reqObj 
 */
function execute(reqObj) {

    for (let i in reqObj.events) {
        let reqEvent = reqObj.events[i];
        console.log(reqEvent);

        switch (reqEvent.type) {
            case 'follow':
                executeFollow(reqEvent);
                break;
            case 'unfollow':
                executeUnfollow(reqEvent);
                break;
            case 'message':
                executeMessage(reqEvent);
                break;
        }
    }
}

/**
 * Followイベント処理
 * @param {Object} reqEvent 
 */
function executeFollow(reqEvent) {
    let msgList = [{
        'type': 'text',
        'text': '赤ちゃんのうんこを記録できます。\n\n【使い方】\n・うんこのメッセージまたはスタンプで時間を記録します。\n・"直近"または"履歴"のメッセージで直近10件の記録を表示します。',
    }];
    sendLinePush(reqEvent.source.userId, msgList);

    let user = getUser(reqEvent.source.userId);
    if (user) {
        userSheet.getRange(user.index + 2, 3).setValue(1);
    } else {
        userSheet.appendRow([reqEvent.source.type, reqEvent.source.userId, 1]);
    }
}

/**
 * UnFollowイベント処理
 * @param {Object} reqEvent 
 */
function executeUnfollow(reqEvent) {
    let user = getUser(reqEvent.source.userId);
    if (user) {
        userSheet.getRange(user.index + 2, 3).setValue(0);
    }
}

/**
 * メッセージイベント処理
 * @param {Object} reqEvent 
 */
function executeMessage(reqEvent) {
    let msgList = [];
    let user = getUser(reqEvent.source.userId);
    if (user) {
        let reqReport = -1;
        switch (reqEvent.message.type) {
            case 'text':
                reqReport = getReportFromText(reqEvent.message.text);
                break;
            case 'sticker':
                reqReport = getReporFromSticker(reqEvent.message.packageId, reqEvent.message.stickerId);
                break;
        }

        let nowTime = (new Date()).getTime();

        switch (reqReport) {
            case 0:
                msgList.push({
                    'type': 'text',
                    'text': 'うんこ承りました。',
                });

                if (user.item.lastDate) {
                    let diffTime = nowTime - user.item.lastDate;
                    if (DAY_TIME < diffTime) {
                        let day = Math.floor(diffTime / DAY_TIME);
                        msgList.push({
                            'type': 'text',
                            'text': `${day}日ぶりに出たね。`,
                        });
                    }
                }

                sendLineReply(reqEvent.replyToken, msgList);
                userSheet.getRange(user.index + 2, 4).setValue(nowTime);
                historySheet.appendRow([user.item.userId, nowTime]);
                break;
            case 1:
                let historyList = getHistoryList(reqEvent.source.userId);
                let msg = '直近の記録（最大10件）\n\n';
                for (let i in historyList) {
                    let history = historyList[i];
                    let timestamp = Utilities.formatDate(new Date(history.recortDt), 'Asia/Tokyo', 'MM月dd日 HH:mm');
                    msg += timestamp + '\n';
                }
                msgList.push({
                    'type': 'text',
                    'text': msg,
                });
                sendLineReply(reqEvent.replyToken, msgList);
                break;
            default:
                msgList.push({
                    'type': 'text',
                    'text': 'わからないよ\nもう一度入力してね',
                });
                sendLineReply(reqEvent.replyToken, msgList);
                break;
        }
    }
}

/**
 * 通知
 */
function notify() {
    try {
        let nowTime = (new Date()).getTime();
        let userList = getUserList();
        for (let i in userList) {
            let user = userList[i];
            if (user.lastDate) {
                let diffTime = nowTime - user.lastDate;
                if (DAY_TIME < diffTime) {
                    let day = Math.floor(diffTime / DAY_TIME);
                    let msgList = [{
                        'type': 'text',
                        'text': `うんこが止まって${day}日目です。`,
                    }];
                    sendLinePush(user.userId, msgList);
                }
            }
        }
    } catch (e) {
        console.error(e.stack);
    }
}

/**
 * テキストからイベント種別を取得する
 * @param {String} text 
 */
function getReportFromText(text) {
    const REPORT_LIST = [
        ['うんこ', 'ウンコ', '出た', 'でた'],
        ['直近', '履歴']
    ];
    for (let i in REPORT_LIST) {
        let itemList = REPORT_LIST[i];
        for (let j in itemList) {
            let item = itemList[j];
            if (text == item) {
                return parseInt(i);
            }
        }
    }
}

/**
 * スタンプからイベント種別を取得する
 * @param {String} packageId 
 * @param {String} stickerId 
 */
function getReporFromSticker(packageId, stickerId) {
    const REPORT_LIST = [
        [{
            packageId: '4',
            stickerId: '284'
        }, {
            packageId: '2000011',
            stickerId: '455795'
        }, {
            packageId: '2000011',
            stickerId: '455798'
        }, {
            packageId: '2000013',
            stickerId: '483667'
        }, {
            packageId: '2000013',
            stickerId: '483668'
        }]
    ];
    for (let i in REPORT_LIST) {
        let itemList = REPORT_LIST[i];
        for (let j in itemList) {
            let item = itemList[j];
            if (item.packageId == packageId && item.stickerId == stickerId) {
                return parseInt(i);
            }
        }
    }
}

/**
 * ユーザーを取得する
 * @param {String} userId 
 */
function getUser(userId) {
    let userList = getUserList();
    for (let i in userList) {
        let user = userList[i];
        if (user.userId === userId) {
            return {
                index: parseInt(i),
                item: user
            };
        }
    }
    return null;
}

/**
 * ユーザー一覧を取得する
 */
function getUserList() {
    let userList = [];
    let lastRow = userSheet.getLastRow();
    if (1 < lastRow) {
        userList = userSheet.getRange(2, 1, lastRow, 6).getValues();
        userList = userList.map((row) => {
            return {
                type: row[0],
                userId: row[1],
                follow: row[2],
                lastDate: row[3],
            }
        });
    }
    return userList;
}

/**
 * 履歴一覧を取得する
 * @param {String} userId 
 */
function getHistoryList(userId) {
    let historyList = [];
    let allHistoryList = getAllHistoryList();
    for (let i in allHistoryList) {
        let hitory = allHistoryList[i];
        if (hitory.userId === userId) {
            historyList.push(hitory);
        }
    }
    return historyList.slice(-10);
}

/**
 * 全履歴一覧を取得する
 */
function getAllHistoryList() {
    let allHistoryList = [];
    let lastRow = historySheet.getLastRow();
    if (1 < lastRow) {
        allHistoryList = historySheet.getRange(1, 1, lastRow, 2).getValues();
        allHistoryList = allHistoryList.map((row) => {
            return {
                userId: row[0],
                recortDt: row[1],
            }
        });
    }
    return allHistoryList;
}

/**
 * LINEにメッセージを送信する
 * @param {String} targetId ターゲットID（userId/groupId/roomId）
 * @param {Object} msgList メッセージリスト
 */
function sendLinePush(targetId, msgList) {
    let url = 'https://api.line.me/v2/bot/message/push';
    let options = {
        'method': 'post',
        'headers': {
            'Content-Type': 'application/json; charset=UTF-8',
            'Authorization': `Bearer ${LINE_CHANNEL_TOKEN}`
        },
        'payload': JSON.stringify({
            to: targetId,
            messages: msgList
        })
    };
    let response = UrlFetchApp.fetch(url, options);
    return JSON.parse(response.getContentText('UTF-8'));
}

/**
 * LINEに応答メッセージを送信する
 * @param {String} replyToken リプライトークン
 * @param {Object} msgList メッセージリスト
 */
function sendLineReply(replyToken, msgList) {
    let url = 'https://api.line.me/v2/bot/message/reply';
    let options = {
        'method': 'post',
        'headers': {
            'Content-Type': 'application/json; charset=UTF-8',
            'Authorization': `Bearer ${LINE_CHANNEL_TOKEN}`
        },
        'payload': JSON.stringify({
            replyToken: replyToken,
            messages: msgList
        })
    };
    let response = UrlFetchApp.fetch(url, options);
    return JSON.parse(response.getContentText('UTF-8'));
}