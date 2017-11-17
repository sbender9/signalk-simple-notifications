const signalkSchema = require('@signalk/signalk-schema')
const Bacon = require('baconjs')
const debug = require('debug')('signalk-simple-notifications')

const relevantKeys = Object.keys(signalkSchema.metadata)
  .filter(s => s.indexOf('/vessels/*') >= 0)
  .map(s => s.replace('/vessels/*', '').replace(/\//g, '.').replace(/RegExp/g, '*').substring(1)).sort()

module.exports = function(app) {
  var plugin = {}
  var unsubscribes = []

  plugin.id = "simple-notifications"
  plugin.name = "Simple Notifications"
  plugin.description = "Signal K server plugin to setup notifications"

  plugin.schema = {
    type: "object",
    properties: {
      paths: {
        type: "array",
        title: " ",
        "default": defaultNotification,
        items: {
          title: "Notifications",
          type: "object",
          required: ["key"],
          properties: {
            "enabled": {
              title: "Enabled",
              type: "boolean",
              default: true
            },
            "key": {
              title: "SignalK Path",
              type: "string",
              default: ""
            },
            "thresholds": {
              "type": "array",
              "title": " ",
              "description": "Add one or more alarm ",
              "items": {
                "type": "object",
                "title": "Alarm",
                "required": ["state", "test", "value", "message"],
                "properties": {
                  "test": {
                    "id": "test",
                    "type": "string",
                    "title": "Test",
                    "description": "The type of comparison",
                    "name": "test",
                    "enum": ["lessthan", "greaterthan"]
                  },
                  
                  "value": {
                    "id": "value",
                    "type": "number",
                    "title": "Value",
                    "description": "The value to alarm on",
                    "name": "value",
                  },

                  "state": {
                    "type": "string",
                    "title": "Alarm State",
                    "description": "The alarm state when the value is in this zone.",
                    "default": "normal",
                    "enum": ["normal", "alert", "warn", "alarm", "emergency"]
                  },

                  "visual": {
                    title: "Visual",
                    type: "boolean",
                    default: true
                  },
                  
                  "sound": {
                    title: "Sound",
                    type: "boolean",
                    default: true
                  },
                  
                  "message": {
                    "id": "message",
                    "type": "string",
                    "title": "Message",
                    "description": "The message to display for the alarm.",
                    "default": ""
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  plugin.start = function(options) {
    unsubscribes = (options.paths || []).reduce((acc, {
      key,
      enabled,
      thresholds,
    }) => {
      if(enabled) {
        var stream = app.streambundle.getSelfStream(key)
        const tests = thresholds.map((alarm, i) => {

          if ( alarm.test == 'lessthan' )
          {
            debug("lessthan")
            return value => value < alarm.value
          }
          else
          {
            return value => value > alarm.value
          }
        })
        acc.push(stream.map(value => {
          return tests.findIndex(test => test(value))
        }).skipDuplicates().onValue(alarmIndex => {
          sendNotificationUpdate(key, alarmIndex, thresholds)
        }))
      }
      return acc
    }, [])
    return true
  }

  plugin.stop = function() {
    unsubscribes.forEach(f => f())
    unsubscribes = []
  }

  function sendNotificationUpdate(key, alarmIndex, thresholds) {
    var value = null
    if(alarmIndex >= 0) {
      const alarm = thresholds[alarmIndex]
      value = {
        state: alarm.state,
        message: alarm.message || 'something',
        method: [],
        timestamp: (new Date()).toISOString()
      }
      if ( alarm.visual )
      {
        value.method.push("visual")
      }
      if ( alarm.sound )
      {
        value.method.push("sound")
      }
    }
    else
    {
      value = {
        state: "normal",
        timestamp: (new Date()).toISOString()
      }
    }
    const delta = {
      context: "vessels." + app.selfId,
      updates: [
        {
          source: {
            label: "self.notificationhandler"
          },
          values: [{
            path: "notifications." + key,
            value: value
          }]
        }
      ]
    }
    debug("delta: " + JSON.stringify(delta))
    app.signalk.addDelta(delta)
  }

  return plugin
}


const defaultNotification = [
  {
    "enabled": false,
    "key": "environment.depth.belowSurface",
    "thresholds": [
      {
        "test": "lessthan",
        "value": 1.8288,
        "state": "emergency",
        "visual": true,
        "sound": true,
        "message": "The depth is below 6 feet"
      }
    ]
  },
  {
    "enabled": false,
    "key": "electrical.batteries.0.voltage",
    "thresholds": [
      {
        "test": "lessthan",
        "value": 11.5,
        "state": "alert",
        "visual": true,
        "sound": true,
        "message": "The battery voltage is below 11.5V"
      },
      {
        "test": "greaterthan",
        "value": 14.5,
        "state": "alert",
        "visual": true,
        "sound": true,
        "message": "The battery voltage is above 14.5V"
      }
    ]
  },
  {
    "enabled": false,
    "key": "propulsion.port.temperature",
    "thresholds": [
      {
        "test": "greaterthan",
        "value": 327.594,
        "state": "alert",
        "visual": true,
        "sound": true,
        "message": "The port engine temperatureis greater than 130F"
      }
    ]
  }
]
