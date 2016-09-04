'use strict'

var services = [{'PTZ': './ptz.json'}, {'MEDIA': './media.json'}, {'DEVICEMGMT': './devicemgmt.json'}];

var spec = {};
spec.configId = 1;
spec.specVersion = {major: 1, minor: 0};
spec.device = {};
spec.device.deviceType = "urn:cdif-net:device:ONVIFCamera:1";
spec.device.friendlyName = "onvif";
spec.device.manufacturer = "manufacturer name";
spec.device.manufacturerURL = "manufacturer URL";
spec.device.modelDescription = "model description";
spec.device.modelName = "model name";
spec.device.modelNumber = "model number";
spec.device.serialNumber = "serial no";
spec.device.UPC = "universal product code";
spec.device.userAuth = false;
spec.device.presentationURL = "presentation URL";
spec.device.iconList = [{
        "mimetype": "image/png",
        "width": 100,
        "height": 80,
        "depth": 32,
        "url": "icon URL"
      }];
spec.device.serviceList = {};

services.forEach(function(service) {
        var key = Object.keys(service);
        var value = service[key];
	var o = require(value);

        var service_name = 'urn:cdif-net:serviceID:ONVIF' + key + 'Service';
        spec.device.serviceList[service_name] = {};
        spec.device.serviceList[service_name].actionList = {};
        spec.device.serviceList[service_name].serviceStateTable = {};

	var actions = o['wsdl:definitions']['wsdl:portType'][0]['wsdl:operation'];
	var types = o['wsdl:definitions']['wsdl:types'][0]['xs:schema'][0]['xs:element'];
	var messages = o['wsdl:definitions']['wsdl:message'];


	var result_actions = {};

	var input_message_names = {};
	var output_message_names = {};

	actions.forEach(function(action) {
	    var name = action.$.name;
            spec.device.serviceList[service_name].actionList[name] = {};
            spec.device.serviceList[service_name].actionList[name].argumentList = {};
	    result_actions[name] = {};
	    result_actions[name].inputArgumentList = [];
	    result_actions[name].outputArgumentList = [];
	});


	actions.forEach(function(action) {
	    var actionName = action.$.name;
	    var input_messages = action['wsdl:input'];
	    var output_messages = action['wsdl:output'];
	    input_messages.forEach(function(input_message) {
		var arr = input_message.$.message.split(':');
		var name = arr[arr.length - 1];
		messages.forEach(function(message) {
		    if(name == message.$.name) {
			var element = message['wsdl:part'][0].$.element;
			var _arr = element.split(':');
			var elementName = _arr[_arr.length - 1];
			types.forEach(function(type) {
			    if (elementName == type.$.name) {
				if (type['xs:complexType'][0]['xs:sequence'] == null) {
				    return;
				} else {
				    var elems = type['xs:complexType'][0]['xs:sequence'][0]['xs:element'];
				    if (elems != null) {
					elems.forEach(function(elem) {
                                            spec.device.serviceList[service_name].actionList[actionName].argumentList[elem.$.name] = {'direction': 'in', 'relatedStateVariable': elem.$.name};
                                            if (spec.device.serviceList[service_name].serviceStateTable[elem.$.name] == null) {
                                                var data_type = 'object';
                                                if (elem.$.type === 'xs:boolean') {
                                                    data_type = 'boolean';
                                                } else if (elem.$.type === 'xs:string') {
                                                    data_type = 'string';
                                                } else if (elem.$.type === 'xs:int') {
                                                    data_type = 'int';
                                                }
                                                spec.device.serviceList[service_name].serviceStateTable[elem.$.name] = {sendEvents: false, 'dataType': data_type};
                                            }
					    result_actions[actionName].inputArgumentList.push(elem.$.name);
					});
				    }
				}
			    }
			});
		    }
		});
	    });
	    output_messages.forEach(function(output_message) {
		var arr = output_message.$.message.split(':');
		var name = arr[arr.length - 1];
		messages.forEach(function(message) {
		    if(name == message.$.name) {
			var element = message['wsdl:part'][0].$.element;
			var _arr = element.split(':');
			var elementName = _arr[_arr.length - 1];
			types.forEach(function(type) {
			    if (elementName == type.$.name) {
				if (type['xs:complexType'][0]['xs:sequence'] == null) {
				    return;
				} else {
				    var elems = type['xs:complexType'][0]['xs:sequence'][0]['xs:element'];
				    if (elems != null) {
					elems.forEach(function(elem) {
                                            spec.device.serviceList[service_name].actionList[actionName].argumentList[elem.$.name] = {'direction': 'out', 'retval': true, 'relatedStateVariable': elem.$.name};
                                            if (spec.device.serviceList[service_name].serviceStateTable[elem.$.name] == null) {
                                                var data_type = 'object';
                                                if (elem.$.type === 'xs:boolean') {
                                                    data_type = 'boolean';
                                                } else if (elem.$.type === 'xs:string') {
                                                    data_type = 'string';
                                                } else if (elem.$.type === 'xs:int') {
                                                    data_type = 'int';
                                                }
                                                spec.device.serviceList[service_name].serviceStateTable[elem.$.name] = {sendEvents: false, 'dataType': data_type};
                                            }
					    result_actions[actionName].outputArgumentList.push(elem.$.name);
					});
				    }
				}
			    }
			});
		    }
		});
	    });
	});
});

console.log(JSON.stringify(spec));


