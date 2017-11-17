const Bacon = require('baconjs')
const debug = require('debug')('signalk-simple-notifications')
const _ = require('lodash')

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
            
            "name": {
              title: "Name",
              description: "If specified, this will be used in the message of the notification, otherwise the displayName or key will be used",
              type: "string",
            },

            "highValue": {
              id: "highValue",
              type: "number",
              title: "High Value",
              description: "If specified, the notification will be raised when th the value goes above this",
              name: "highValue",
            },

            "lowValue": {
              id: "lowValue",
              type: "number",
              title: "Low Value",
              description: "If specified, the notification will be raised when th the value goes below this",
              name: "lowValue",
            },            
            
            "state": {
              type: "string",
              title: "Alarm State",
              description: "The alarm state when the value is in this zone.",
              default: "normal",
              enum: ["normal", "alert", "warn", "alarm", "emergency"]
            },
            
            "visual": {
              title: "Visual",
              type: "boolean",
              description: "Display a visual indication of the notification",
              default: true
            },
                  
            "sound": {
              title: "Sound",
              type: "boolean",
              description: "Sound an audible indication of the notification",
              default: true
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
      name,
      lowValue,
      highValue,
      state,
      visual,
      sound
    }) => {
      if(enabled) {
        var stream = app.streambundle.getSelfStream(key)
        acc.push(stream.map(value => {
          if ( typeof lowValue !== 'undefined' && value < lowValue ) {
            return -1
          } else if ( typeof highValue !== 'undefined' && value > highValue ) {
            return 1
          } else {
            return 0
          }
        }).skipDuplicates().onValue(current => {
          sendNotificationUpdate(key, current, name, lowValue, highValue, state, visual, sound)
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

  function sendNotificationUpdate(key, current, name, lowValue, highValue, state, visual, sound ) {
    var value = null
    if(current != 0) {
      value = {
        state: state,
        method: [],
        timestamp: (new Date()).toISOString()
      }
      if ( visual ) {
        value.method.push("visual")
      }
      if ( sound ) {
        value.method.push("sound")
      }
      var test = current == -1 ? 'less than' : 'more than';
      var val = current == -1 ? lowValue : highValue
      if ( typeof name === 'undefined' ) {
        name = _.get(app.signalk.self, key + ".meta.displayName")
        if ( !name ) {
          name = key;
        }
      }
      value["message"] = `The ${name} is ${test} ${val}`
    } else {
      value = {
        state: "normal",
        timestamp: (new Date()).toISOString(),
        message: `The ${name} is normal`
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
    "name": "depth",
    "lowValue": 1.8288,
    "state": "emergency",
    "visual": true,
    "sound": true
  },
  {
    "enabled": false,
    "key": "electrical.batteries.0.voltage",
    "name": "battery voltage",
    "lowValue": 11.5,
    "highValue": 14.5,
    "state": "alert",
    "visual": true,
    "sound": true,
  },
  {
    "enabled": false,
    "key": "propulsion.port.temperature",
    "name": "enging temperature",
    "highValue": 327.594,
    "state": "alert",
    "visual": true,
    "sound": true
  }
]
