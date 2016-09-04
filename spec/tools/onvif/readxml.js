var fs = require('fs'),
    xml2js = require('xml2js');
 
var parser = new xml2js.Parser();
fs.readFile(__dirname + '/onvif.xsd', function(err, data) {
    if (err) { console.error(err);}
    parser.parseString(data, function (err, result) {
        if (err) { console.error(err);}
        console.log(JSON.stringify(result));
    });
});
