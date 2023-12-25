const express = require('express')
const router = express.Router()

var fitnessMaxArray = [
    {
        'exerciseName': 'Squat',
        'Karl-Emil': 1,
        'Andreas': 2,
        'Tobias': 3,
        'Mor': 4,
        'Far': 5
    },
    {
        'exerciseName': 'Dødløft',
        'Karl-Emil': 1,
        'Andreas': 2,
        'Tobias': 3,
        'Mor': 4,
        'Far': 5
    },
    {
        'exerciseName': 'Row',
        'Karl-Emil': 1,
        'Andreas': 2,
        'Tobias': 3,
        'Mor': 4,
        'Far': 5
    }
]


var fitnessRepsArray = [
    {
        'exerciseName': 'Squat',
        'Karl-Emil': 2,
        'Andreas': 4,
        'Tobias': 6,
        'Mor': 8,
        'Far': 10
    },
    {
        'exerciseName': 'Dødløft',
        'Karl-Emil': 2,
        'Andreas': 4,
        'Tobias': 6,
        'Mor': 8,
        'Far': 10
    },
    {
        'exerciseName': 'Row',
        'Karl-Emil': 2,
        'Andreas': 4,
        'Tobias': 6,
        'Mor': 8,
        'Far': 10
    }
]


router.get('/api/fitness/max', (req, res) => {
    res.json(fitnessMaxArray)
}) 

router.get('/api/fitness/reps', (req, res) => {
    res.json(fitnessRepsArray)
})



module.exports = router