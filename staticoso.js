// this takes all provided html files runs through the text, and replaces the variables with the values from the template

var fs = require('fs');

// if the first command line argument is -h or --help, print the help message
if (process.argv[2] == '-h' || process.argv[2] == '--help' || process.argv.length < 3) {
    console.log('Staticoso takes all files in a folder replaces the variables in the file with the values from the staticoso.json file');
    console.log('Usage: node staticoso.js workingfolder [--selector XX] [--simulate] [--vars "XX"="YY","ZZ"="WW"]');
    console.log('Staticoso will go through all selectors in the template file, unless one specific selector is specified');
    console.log('Example: node staticoso.js ./src/ --selector en --simulate --vars "date"="1955-10-25","version"="1.0.0"');
    console.log('The staticoso.json file can describe other extensions that the standard HTML extension');
    process.exit(0);
}

// get first command line argument
var folder = process.argv[2];
// the selector is used to select among different versions of a variable
// check if --selector is provided and if yes get the next argument
var selector = undefined;
var selectorIndex = process.argv.indexOf('--selector');
if (selectorIndex != -1) {
    selector = process.argv[selectorIndex + 1];
};
var vars = undefined;
var argumentString = process.argv.map( function(arg) { return arg.toString(); } ).join(' ');
// check if --vars is provided and if yes get the next argument
var varsIndex = argumentString.indexOf('--vars ');
if (varsIndex != -1) {
    vars = [];
    // find the next occurrence of -- or the end of the command line arguments
    var varsEndIndex = argumentString.indexOf('--', varsIndex+2);
    if (varsEndIndex == -1) {
        varsEndIndex = argumentString.length;
    }
    
    var varHelper = argumentString.substring(varsIndex + '--vars'.length, varsEndIndex);
    varHelper.split(',').forEach( item => {
        var keyValue = item.split('=');
        vars[keyValue[0].replace('"', '').trim()] = keyValue[1].replace('"', '');
    });
}

var simulate = process.argv.indexOf('--simulate') != -1;
var verbose = process.argv.indexOf('--verbose') != -1;

// read the staticoso.json file
var template = JSON.parse(fs.readFileSync(folder + '/staticoso.json', 'utf8'));
var templateVariables = [];
var templateIncludes = {};
var extensions = template["extensions"];
var renames = template["renames"];
var ignores = template["ignores"];
var targetFolders = template["targetFolders"];

Object.keys(template["variables"]).forEach(varKey => {
    templateVariables[varKey.toLowerCase()] = template["variables"][varKey];
});

// if variables were passed and are available in the array vars add them to the templateVariables
if (vars != undefined) {
    // add the variables to the templateVariables
    Object.keys(vars).forEach(varKey => {
        templateVariables[varKey.toLowerCase()] = vars[varKey];
    });
}

Object.keys(template["includes"]).forEach(varKey => {
    templateIncludes[varKey.toLowerCase()] = template["includes"][varKey];
});

// fill the variable extensions with the standard if it is undefined
if (extensions == undefined) {
    extensions = ['htm', 'html'];
}

// read all files with the provided extensions
// if no extensions are provided, it will default to .htm and .html
var files = fs.readdirSync(folder).filter(function (file) {
    // return all files that match the extensions
    return extensions.indexOf(file.split('.').pop()) > -1;
});

var selectors = [];
// if selector is undefined, it will run through all selectors in the variables and the includes
if (selector == undefined) {
    // search for the first object in the variables
    for (var key in templateVariables) {
        if (typeof (templateVariables[key]) === 'object') {
            selectors = Object.values(templateVariables[key]);
            break;
        }
    }
} else {
    if (selector == undefined) {
        // search for the first object in the variables
        for (var key in templateIncludes) {
            if (typeof (templateIncludes[key]) === 'object') {
                selectors = Object.values(templateIncludes[key]);
                break;
            }
        }
    } else {
        selectors.push(selector);
    }
}
// get through all the files
files.forEach(function (file) {
    // skip the file if it is in the ignores list
    if (ignores.indexOf(file) > -1) {
        return;
    }
    console.log('Processing file: ' + file);

    // read the file
    var sourceFileContent = fs.readFileSync(folder + '/' + file, 'utf8');
    // get the variables that match {{ variable }} with and  without spaces and return the content of the matching variable without the brackets
    var sourceVariables = sourceFileContent.match(/\{\{[^\}]*\}\}/g);
    // build an associative array with the variables and their values
    var variables = {};
    if (sourceVariables == null) {
        console.log('No variables found in file: ' + file);
    }
    // if variables to replace are found, replace them
    if (sourceVariables != null) {
        console.log('Found ' + sourceVariables.length + ' variables in file: ' + file);
        sourceVariables.forEach(sourceVariable => {
            variables[sourceVariable] = sourceVariable.replace(/\{\{|\}\}/g, '').trim().toLowerCase();
        });

        // iterate over all selectors
        selectors.forEach(actualSelector => {
            var newFileContent = sourceFileContent;
            console.log('Using selector', actualSelector);
            // get the values for the variables
            sourceVariables.forEach(sourceVariable => {
                // get the value, either the standard one, or the selected one or the value, if it's not an object
                var valueWasIncluded = false;
                var templateValue = templateVariables[variables[sourceVariable]];
                // if the value is not defined, we try to get it from the templateIncludes
                if (templateValue == undefined) {
                    // we read the content of the include into the variable templateValue
                    // check if the file exists
                    if (fs.existsSync(folder + '/' + templateIncludes[variables[sourceVariable]])) {
                        templateValue = fs.readFileSync(folder + '/' + templateIncludes[variables[sourceVariable]], 'utf8');
                        valueWasIncluded = true;
                    }
                }
                var actualValue = "";
                if (typeof (templateValue) === 'object') {
                    // if the value is an object, we try to get the value for the actualSelector
                    actualValue = templateValue[actualSelector];
                } else {
                    actualValue = templateValue;
                }
                if (actualValue == undefined) {
                    // search occurrence in line and get the line number
                    var lineNumber = newFileContent.substring(0, newFileContent.indexOf(sourceVariable)).split('\n').length;
                    console.error('Variable "', sourceVariable, '" found in file on line', lineNumber, 'not found in staticoso template file (' + variables[sourceVariable] + ')');
                } else {
                    newFileContent = newFileContent.replace(sourceVariable, actualValue);
                    if (verbose){
                        if (valueWasIncluded){
                            console.log('Setting variable ' + sourceVariable + ' with included file: ' + templateIncludes[variables[sourceVariable]]);
                        } else {
                            console.log('Setting variable ' + sourceVariable + ' with value: ' + actualValue);
                        }
                    }
                }
            });

            // create the folder public if it doesn't exist
            if (!fs.existsSync(folder + '/public')) {
                fs.mkdirSync(folder + '/public');
            }
            // append the selector to the file name if it is not undefined
            var fileToSave = file;
            if (actualSelector != undefined) {
                var extension = fileToSave.split('.').pop();
                fileToSave = fileToSave.replace('.' + extension, '_' + actualSelector + '.' + extension);
            }
            // write out the html to a new file
            console.log('Writing file: ' + folder + '/public/' + fileToSave);
            // check if this file has to be renamed
            if (renames != undefined) {
                if (renames[fileToSave] != undefined) {
                    fileToSave = renames[fileToSave];
                    console.log('Renaming file to: ' + fileToSave);
                }
            }
            if (targetFolders != undefined) {
                if (targetFolders[fileToSave] != undefined) {
                    fileToSave = targetFolders[fileToSave] + '/' + fileToSave;
                    console.log('Specific subfolder included: ' + fileToSave);
                }
            }
            if (!simulate){
                //fs.writeFileSync(folder + '/public/' + fileToSave, newFileContent);
            } else {
                console.log('Simulating writing file: ' + folder + '/public/' + fileToSave);
            }
        });
    }
    console.log('-------------------------------------------');
    console.log('');
});