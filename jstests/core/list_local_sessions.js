// Basic tests for the $listLocalSessions aggregation stage.

(function() {
    'use strict';

    const admin = db.getSisterDB('admin');
    function listLocalSessions() {
        return admin.aggregate([{'$listLocalSessions': {allUsers: false}}]);
    }

    // Start a new session and capture its sessionId.
    const myid = assert.commandWorked(db.runCommand({startSession: 1})).id.id;
    assert(myid !== undefined);

    // Ensure that the cache now contains the session and is visible.
    const resultArray = assert.doesNotThrow(listLocalSessions).toArray();
    assert.gte(resultArray.length, 1);
    const resultArrayMine = resultArray
                                .map(function(sess) {
                                    return sess._id.id;
                                })
                                .filter(function(id) {
                                    return 0 == bsonWoCompare({x: id}, {x: myid});
                                });
    assert.eq(resultArrayMine.length, 1);

    // Try asking for the session by username.
    const myusername = (function() {
        if (0 == bsonWoCompare({x: resultArray[0]._id.uid}, {x: computeSHA256Block("")})) {
            // Code for "we're running in no-auth mode"
            return {user: "", db: ""};
        }
        const connstats = assert.commandWorked(db.runCommand({connectionStatus: 1}));
        const authUsers = connstats.authInfo.authenticatedUsers;
        assert(authUsers !== undefined);
        assert.eq(authUsers.length, 1);
        assert(authUsers[0].user !== undefined);
        assert(authUsers[0].db !== undefined);
        return {user: authUsers[0].user, db: authUsers[0].db};
    })();
    function listMyLocalSessions() {
        return admin.aggregate([{'$listLocalSessions': {users: [myusername]}}]);
    }
    const myArray = assert.doesNotThrow(listMyLocalSessions)
                        .toArray()
                        .map(function(sess) {
                            return sess._id.id;
                        })
                        .filter(function(id) {
                            return 0 == bsonWoCompare({x: id}, {x: myid});
                        });
    assert.eq(0, bsonWoCompare(myArray, resultArrayMine));
})();
