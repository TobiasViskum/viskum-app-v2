const express = require('express');
const app = express();
const server = require('http').createServer(app)
const path = require('path')
const io = require('socket.io')(server, {
    cors: {
        origin: true
    }
})

const mysql = require('mysql')


app.use(express.json())
app.use(express.static('dist'))

const db = mysql.createPool({
    user: "tobias",
    host: "192.168.2.35",
    password: "fitness",
    database: "fitness_db",
    connectionLimit: 20
});


app.get('/api/get/profile_data', (req, res) => {
    const uid = req.query.uid

    db.query('SELECT * FROM dim_profile AS A INNER JOIN dim_profile_group AS B ON A.profile_group_id = B.id WHERE A.uid=(?)', [uid],
    (err, result) => {
        if (err) {
            console.log(err);
        } else {
            res.send(result)
        }
    })
})
app.get('/api/get/profile_group_members_data', (req, res) => {
    const uid = req.query.uid

    db.query('SELECT A.name, A.uid FROM dim_profile AS A INNER JOIN dim_profile_group AS B ON A.profile_group_id = B.id WHERE A.profile_group_id IN (SELECT A.profile_group_id FROM dim_profile AS A INNER JOIN dim_profile_group AS B ON A.profile_group_id = B.id WHERE A.uid=(?))', [uid],
    (err, result) => {
        if (err) {
            console.log(err);
        } else {
            res.send(result)
        }
    })
})



app.get('/api/fitness/get/remaining_exercises', (req, res) => {
    const profile = req.query.profile
    const toggle = req.query.toggle == 1 ? 'has_reps' : 'has_max'

    db.query(`SELECT DISTINCT A.name FROM fitness_stat_table AS A WHERE A.profile != '${profile}'`, //SELECT DISTINCT A.name FROM fitness_stat_table AS A WHERE A.name NOT IN (SELECT DISTINCT B.name FROM fitness_stat_table AS B WHERE B.profile = '${profile}' AND B.${toggle} = 1) ORDER BY A.name
    (err, result) => {
        if (err) {
            console.log(err);
        } else {
            res.send(result)
        }
    })
})
app.get("/api/fitness/get", (req, res) => {
    const profile = req.query.profile

    db.query(`SELECT A.*, F.show_vas_fitness, C.unit_name, B.group_name AS group_name_max, D.group_name AS group_name_reps, E.reps_range_name FROM fitness_stat_table A LEFT JOIN dim_grouping B ON A.group_id_max = B.group_id LEFT JOIN dim_grouping D ON A.group_id_reps = D.group_id INNER JOIN dim_units C ON A.unit_id = C.unit_id INNER JOIN dim_reps_range AS E ON A.reps_range_id = E.reps_range_id INNER JOIN dim_profile AS F ON A.profile = F.uid WHERE A.profile=(?)`, [profile],
        (err, result) => {
            if (err) {
                console.log(err);
            } else {
                res.send(result)
            }
        }
    );
});
app.get("/api/fitness/get/group", (req, res) => {
    db.query(`SELECT A.group_id, A.group_name FROM dim_grouping AS A ORDER BY A.group_sort_order, A.group_name`, (err, result) => {
            if (err) {
                console.log(err);
            } else {
                res.send(result)
            }
        }
    );
});
app.get("/api/fitness/get/unit", (req, res) => {
    db.query(`SELECT A.unit_id, A.unit_name FROM dim_units AS A ORDER BY A.unit_name`, (err, result) => {
            if (err) {
                console.log(err);
            } else {
                res.send(result)
            }
        }
    );
});
app.get("/api/fitness/get/reps_range", (req, res) => {
    db.query(`SELECT A.reps_range_id, A.reps_range_name FROM dim_reps_range as A ORDER BY A.sort_order`, (err, result) => {
            if (err) {
                console.log(err);
            } else {
                res.send(result)
            }
        }
    );
});
app.put("/api/fitness/update", (req, res) => {
    const isDateLocked = req.body.isDateLocked
    const id = req.body.id
    const type = req.body.type
    const newAmount = req.body.newAmount == '' ? 0 : req.body.newAmount
    const new_date = newAmount != 0 ? new Date() : null

    let sqlQuery
    
    if (isDateLocked == 1) {
        sqlQuery = `UPDATE fitness_stat_table SET ${type}=${newAmount} WHERE id=${id}`
    } else {
        sqlQuery = `UPDATE fitness_stat_table SET ${type}=${newAmount}, updated_date_${type}=? WHERE id=${id}`
    }

    db.query(sqlQuery, [new_date],
        (err, result) => {
            if (err) {
                console.log(err);
            } else {
                res.send('Values updated');
            }
        }
    );
});

app.put("/api/fitness/update/specific", (req, res) => {
    const id = req.body.id
    const type = req.body.type
    const valueName = req.body.valueName
    const newValue = valueName == 'date' ? (req.body.newValue ? (new Date(req.body.newValue)) : null) : req.body.newValue
    const profile = req.body.profile
    const prevName = req.body.prevName

   const nameMatchDict = {
    'max' : {
        'date' : 'updated_date_max',
        'compete' : 'is_competing',
        'group' : 'group_id_max',
        'unit' : 'unit_id',
        'notes' : 'notes_max',
        'name' : 'name',
        'lock' : 'is_date_locked'
    },
    'reps' : {
        'date' : 'updated_date_reps',
        'group' : 'group_id_reps',
        'unit' : 'unit_id',
        'notes' : 'notes_reps',
        'reps range' : 'reps_range_id',
        'name' : 'name',
        'vas' : 'vas_reps',
        'lock' : 'is_date_locked'
    }
   }   

   const foundValueName = nameMatchDict[type][valueName]

   if (foundValueName == 'name') {
    db.query('SELECT id FROM fitness_stat_table WHERE name=? AND profile=?', [newValue, profile],
    (err, result) => {
        if (err) {
            console.log(err);
        } else {
            if (result.length == 0) {
                db.query('UPDATE fitness_stat_table SET name=? WHERE id=?', [newValue, id],
                (err, result) => {
                    if (err) {
                        console.log(err);
                    } else {
                        db.query('UPDATE fitness_stat_history SET exercise=? WHERE exercise=? AND profile_uid=?', [newValue, prevName, profile],
                        (err, result) => {
                            if (err && err.errno != 1213) {
                                console.log(err);
                            } else {
                                res.send('Values updated');
                            } 
                        }) 
                    }
                })
            } else if (result.length > 0) {
                res.send('Exercise already exists!')
            }
        }
    })
   } else {
    db.query(`UPDATE fitness_stat_table SET ${foundValueName}=(?) WHERE id=(?)`,
        [newValue, id],
        (err, result) => {
            if (err) {
                console.log(err);
            } else {
                res.send('Values updated');
            }
        }
    );
   }
});
app.put("/api/fitness/delete", (req, res) => {
    const id = req.body.id
    const type = req.body.type == 'reps' ? 'has_reps' : 'has_max'
    const has_max = req.body.has_max
    const has_reps = req.body.has_reps

    let sqlQuery
    if (has_max == 0 && has_reps == 0) {
        sqlQuery = `DELETE FROM fitness_stat_table WHERE id=${id}`
        } else {
        sqlQuery = `UPDATE fitness_stat_table SET ${type}=0 WHERE id=${id}`
    }

    db.query(sqlQuery,
        (err, result) => {
            if (err) {
                console.log(err);
            } else {
                res.send('Values updated');
            }
        }
    );

});
app.put("/api/fitness/add", (req, res) => {
    const profile = req.body.profile
    const newName = req.body.newName
    const addMax = req.body.addMax ? 1 : 0
    const addReps = req.body.addReps ? 1 : 0

    let duplicateCommand = ''

    if (addMax == 1 && addReps == 1) {
        duplicateCommand = 'has_max=1, has_reps=1'
    } else if (addMax == 1) {
        duplicateCommand = 'has_max=1'
    } else if (addReps == 1) {
        duplicateCommand = 'has_reps=1'
    }

    db.query(`INSERT INTO fitness_stat_table SET profile=(?), name=(?), has_max=(?), has_reps=(?), unit_id=1 ON DUPLICATE KEY UPDATE ${duplicateCommand}`,
        [profile, newName, addMax, addReps],
        (err, result) => {
            if (err) {
                console.log(err);
            } else {
                res.send('Values updated');
            }
        }
    );

});
app.get('/api/fitness/get/graph', (req, res) => {
    const profile = req.query.profile
    const toggle = req.query.toggle == 1 ? 'reps' : 'max'
    const exerciseName = req.query.name

    db.query(`SELECT A.date, A.${toggle} AS amount, A.vas_${toggle} AS vas FROM fitness_stat_history AS A WHERE A.profile_uid=? AND A.exercise=? ORDER BY A.date ASC`, [profile, exerciseName],
    (err, result) => {
        if (err) {
            console.log(err);
        } else {
            res.send(result)
        }
    })
})


app.get('/api/hund/ta/get', (req, res) => {
    db.query('SELECT * FROM hund_stat_table', (err, result) => {
        if (err) {
            console.log(err);
        } else {
            res.send(result)
        }
    })
})
app.put('/api/hund/ta/update', (req, res) => {
    const profile = req.body.profile
    const newAmount = req.body.points

    db.query(`UPDATE hund_stat_table SET points=? WHERE profile=?`, [newAmount, profile], 
    (err, result) => {
        if (err) {
            console.log(err);
        } else {
            res.send('Values updated');
        }
    })
})

app.get("/api/cardio/get", (req, res) => {
    const profile = req.query.profile
    const discipline = req.query.discipline
    const type = req.query.type

    db.query("SELECT A.*, B.show_vas_cardio FROM cardio_stat_table AS A INNER JOIN dim_profile AS B ON A.profile = B.uid WHERE profile=? AND discipline=? AND type=? ORDER BY updated_date DESC", [profile, discipline, type],
    (err, result) => {
            if (err) {
                console.log(err);
            } else {
                res.send(result)
            }
        }
    );
});
app.put("/api/cardio/update", (req, res) => {
    const id = req.body.id
    const category = req.body.category
    const newAmount = req.body.newAmount == '' ? 0 : req.body.newAmount
    const isDateLocked = req.body.isDateLocked
    const new_date = new Date()

    let sqlQuery
    if (isDateLocked) {
        sqlQuery = `UPDATE cardio_stat_table SET ${category}=${newAmount} WHERE id=${id}`
    } else {
        sqlQuery = `UPDATE cardio_stat_table SET ${category}=${newAmount}, updated_date=? WHERE id=${id}`
    }

    db.query(sqlQuery, [new_date],
        (err, result) => {
            if (err) {
                console.log(err);
            } else {
                res.send('Values updated');
            }
        }
    );
});
app.put("/api/cardio/add", (req, res) => {
    const profile = req.body.profile
    const name = req.body.name
    const discipline = req.body.discipline
    const type = req.body.type
    const new_date = new Date()

    db.query(`INSERT INTO cardio_stat_table SET profile=?, name=?, discipline=?, type=?, updated_date=?`,
        [profile, name, discipline, type, new_date, name],
        (err, result) => {
            if (err) {
                console.log(err);
            } else {
                res.send('Values updated');
            }
        }
    );
});
app.put("/api/cardio/update/specific", (req, res) => {
    const id = req.body.id
    const valueName = req.body.valueName
    let newAmount = valueName == 'date' ? (req.body.newAmount ? (new Date(req.body.newAmount)) : null) : req.body.newAmount

   const nameMatchDict = {
    'name' : 'name',
    'date' : 'updated_date',
    'lock' : 'is_date_locked',
    'closed' : 'is_closed',
    'vas': 'vas'
   }

   const foundValueName = nameMatchDict[valueName]

    db.query(`UPDATE cardio_stat_table SET ${foundValueName}=(?) WHERE id=(?)`,
        [newAmount, id],
        (err, result) => {
            if (err) {
                console.log(err);
            } else {
                res.send('Values updated');
            }
        }
    );

});
app.put("/api/cardio/delete", (req, res) => {
    const id = req.body.id

    db.query(`DELETE FROM cardio_stat_table WHERE id=?`, [id],
        (err, result) => {
            if (err) {
                console.log(err);
            } else {
                res.send('Values updated');
            }
        }
    );
});
app.get('/api/cardio/get/graph', (req, res) => {
    const profile = req.query.profile
    const name = req.query.name
    const discipline = req.query.discipline
    const stroke = req.query.stroke
    const type = req.query.type

    db.query(`SELECT * FROM cardio_stat_table WHERE profile=? AND discipline=? AND type=? ORDER BY updated_date`, [profile, discipline, type],
    (err, result) => {
        if (err) {
            console.log(err);
        } else {
            res.send(result)
        }
    })
})

const sqlString = 'SELECT A.id, A.profile, CONVERT(A.message USING utf8mb4) AS message, A.created_at, B.name FROM chat_stat_table AS A INNER JOIN dim_profile AS B ON A.profile = B.uid'

app.get('/api/chat/get', (req, res) => {
    db.query(sqlString, 
    (err, result) => {
        if (err) {
            console.log(err);
        } else {
            res.send(result)
        }
    })
})
app.put('/api/chat/delete', (req, res) => {
    const id = req.body.id

    db.query('DELETE FROM chat_stat_table WHERE id=?', [id],
    (err, result) => {
        if (err) {
            console.log(err);
        } else {
            res.send('Deleted chat succesfully')
        }
    })
})

app.get('/api/settings/get', (req, res) => {
    const uid = req.query.uid

    db.query('SELECT * FROM dim_profile WHERE uid=?', [uid],
    (err, result) => {
        if (err) {
            console.log(err);
        } else {
            res.send(result)
        }
    })
})
app.put('/api/settings/update', (req, res) => {
    const uid = req.body.uid
    const valueName = req.body.valueName
    const newValue = req.body.newValue

    const nameMatchDict = {
        'isTextCentered' : 'is_text_centered',
        'language' : 'language',
        'isRepsDefault' : 'is_reps_default',
        'showVasFitness' : 'show_vas_fitness',
        'showVasCardio' : 'show_vas_cardio',
        'name' : 'name'
       }
       
   const foundValueName = nameMatchDict[valueName]

    db.query(`UPDATE dim_profile SET ${foundValueName}=(?) WHERE uid=(?)`, [newValue, uid],
    (err, result) => {
        if (err) {
            console.log(err);
        } else {
            res.send(result)
        }
    })
})



//server rerender
app.get('/*', function(req, res) {
    res.sendFile(path.join(__dirname, '../dist/index.html'), function(err) {
      if (err) {
        res.status(500).send(err)
      }
    })
})



const port = process.env.PORT || 5174
server.listen(port, () => console.log('Server is now running, succesfully!'))


//chat system

io.on('connection', socket => {
    socket.on('sendMessage', (uid, name, message) => {
        db.query('INSERT INTO chat_stat_table (profile, message, created_at) VALUES (?, ?, ?)', [uid, message, (new Date())], 
        (err, result) => {
            if (err) {
                console.log(err);
            } else {
                db.query(sqlString, 
                (err, result) => {
                    if (err) {
                        console.log(err);
                    } else {
                        io.emit('messageRefresh', [result, true])
                    }
                }
                )
            }
        }
        )
    })
    socket.on('deleteMessage', (id) => {
        db.query('DELETE FROM chat_stat_table WHERE id=?', [id],
        (err, result) => {
            if (err) {
                console.log(err);
            } else {
                db.query(sqlString, 
                (err, result) => {
                    if (err) {
                        console.log(err);
                    } else {
                        io.emit('messageRefresh', [result, false])
                    }
                }
                )
            }
        }
        )
    })
})




