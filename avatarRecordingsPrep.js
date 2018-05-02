// Dependencies
    const fs = require('fs');
    const path = require('path');
    const rimraf = require('rimraf');
    const createCSVFile = require('csv-file-creator');
    const jimp = require('jimp');

/*
    // Arg Vars
        const copyLocal = process.argv[2];
        console.log("copyLocal:", copyLocal);
        let targetTemplateDirectory = ''
        let targetMDDirectory = ''
        if (copyLocal){
            targetTemplateDirectory = process.argv[3];
            targetMDDirectory = process.argv[4];;
        }
*/

// Required directories
    const dir_in = path.join(__dirname, 'in');
    const dir_out = path.join(__dirname, 'out');

// Init Constants
    const BASE_UPLOAD_URL = "https://s3.amazonaws.com/hifi-content/milad/ROLC/Organize/Projects/Testing/Flow/out/";
    const NUMBER_OF_AVATARS_NEEDED = 2;
    const regEx_fst_name = /(name = )(.*?)\n/;
    const regEx_fst_fileName = /(filename = )(.*)(\/.*)(\..*)\n/
    const regEx_fst_textDir = /(texdir = )([\s\S]*)(\/.*)\n/

// General Variables
    let fbxDirectoryName = "jamica_mon";
    let textureDirectoryName = "textures";   
    let avatarBaseFileName;
    let inputFiles;
    let fstFileRead;
    let currCount = 1;   
    let currFilesRead;
    let currFstFile;
    let currentAvatarBasePath;
    let currentAvatarFbxPath;
    let currentAvatarTexturePath;
    let currentFolderArray;
    let currentAvatarName;
    let csvDataArray = [["Avatar_UN", "Avatar_FST", "Avatar_HFR"]];
    let imageOptions = [ 
        {type: "brightness" , options: [-1,1]},
        {type: "contrast" , options: [-1,1]},
        {type: "invert" , options: []},
        {type: "blur" , options: [0]},
        {type: "greyscale" , options: []},
        {type: "posterize" , options: [0]},        
        {type: "sepia" , options: []}, 
        {type: "color", modifier: "lighten", options: [0, 100]},
        {type: "color", modifier: "desaturate", options: [0, 100]},
        {type: "color", modifier: "hue", options: [-360, 360]},   
        {type: "color", modifier: "tint", options: [0, 100]}, 
        {type: "color", modifier: "shade ", options: [0, 100]}, 
        {type: "color", modifier: "red", options: [0, 100]},
        {type: "color", modifier: "green", options: [0, 100]},
        {type: "color", modifier: "blue", options: [0, 100]}
    ];
    let imageOptionsLength = imageOptions.length;
    console.log("imageOptionsLength", imageOptionsLength);

// File Input Store;
    let fileInputStore = {
            fst_directory: '',
            fst_file: '',
            fbx_directory: '',
            fbx_file: '',
            texture_directory: '',       
            texture_files: []
    }

// Helper functions
    function getRandomInt(min, max) {
        // console.log("min", min);
        // console.log("max", max);
        
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min)) + min; 
    }

    function pickManips(amount){
        var manipArray = [];
        let count = 0;
        while (count < amount) {
            let randomInit = getRandomInt(0, imageOptionsLength);
            // console.log("randominit:", randominit);
            manipArray.push(imageOptions[randomInit])
            count++
        };
        // console.log("manipArray", manipArray)
        return manipArray;
    }

    function processManip(manipArray){
        console.log("manipArray", manipArray);
        let processManipArray = [];
        let colorArray = [];
        manipArray.forEach((manip)=>{
            // console.log("manip", manip)
            if (manip.type === "color"){
                // console.log("color PUSH");
                colorArray.push(
                    {apply: manip.modifier, params: 
                        [getRandomInt(manip.options[0], manip.options[1])]})
            } else if (manip.options.length = 0) {
                processManipArray.push({method: manip.type, params: []})
            } else {
                // console.log("other Array  PUSH");
                
                processManipArray.push({method: manip.type, params: [getRandomInt(manip.options[0], manip.options[1])]}) 
            }
            
        })
        return [processManipArray, colorArray];
    }

    // Copy file from source to target - used for recurssive call
    function copyFileSync( source, target ) {
        let targetFile = target;

        // If target is a directory a new file with the same name will be created
        if ( fs.existsSync( target ) ) {
            // console.log("target exists");
            if ( fs.lstatSync( target ).isDirectory() ) {
                // console.log("target is a directory");
                
                targetFile = path.join( target, path.basename( source ) );
            }
        }

        fs.writeFileSync(targetFile, fs.readFileSync(source));
    }

    // Copy file from source to target
    function copyFolderRecursiveSync( source, target ) {
        var files = [];

        // Check if folder needs to be created or integrated
        var targetFolder = path.join( target, path.basename( source ) );
        if ( !fs.existsSync( targetFolder ) ) {
            fs.mkdirSync( targetFolder );
        }

        // Copy
        if ( fs.lstatSync( source ).isDirectory() ) {
            files = fs.readdirSync( source );
            files.forEach( function ( file ) {
                var curSource = path.join( source, file );
                if ( fs.lstatSync( curSource ).isDirectory() ) {
                    copyFolderRecursiveSync( curSource, targetFolder );
                } else {
                    copyFileSync( curSource, targetFolder );
                }
            });
        }
    }
    
    function baseFSTMaker(count, fst){
        let fakeSplitArray = [];
        let fakeSplit = "name = jamica_mon"
        fakeSplitArray[0] = fakeSplit;
        var newFstFile = fst.split('\n');
        let nameSearch = "name";
        // name = jamica_mon
        let fileNamesearch = "filename"
        // filename = jamica_mon/jamica_mon.fbx
        let textDirSearch = "texdir"
        // texdir = jamica_mon/textures
        let nameSearchIndex = newFstFile.indexOf(nameSearch);
        let nameSearchIndex2 = fakeSplitArray.indexOf(nameSearch);        
        console.log("nameSearchIndex", nameSearchIndex)
        console.log("nameSearchIndex2", nameSearchIndex2)
        
        let fileNamesearchIndex = newFstFile.indexOf(fileNamesearch);
        let textDirSearchIndex = newFstFile.indexOf(textDirSearch);
        newFstFile[nameSearchIndex] = `name = jamica_mon_${count}`
        newFstFile[fileNamesearchIndex] = `filename = jamica_mon_${count}/jamica_mon_${count}.fbx`
        newFstFile[textDirSearchIndex] = `texdir = jamica_mon_${count}/textures`
        // console.log("regEx_fst_name", newFstFile.match(regEx_fst_name));
        // console.log("regEx_fst_name", regEx_fst_name);
        // newFstFile = newFstFile.replace(regEx_fst_name, `$1$2_${count}\n`)
        //                        .replace(regEx_fst_fileName, `$1$2_${count}$3_${count}$4\n`)
        //                        .replace(regEx_fst_textDir, `$1$2_${count}$3\n`);

        console.log("newFstFile", newFstFile.join("\n"));
        return newFstFile.join("\n");
    }

    function csvEntryMaker(avatarUn){
        let array = [];
        array.push(avatarUn,`${BASE_UPLOAD_URL}${avatarUn}.fst`,`${BASE_UPLOAD_URL}${avatarUn}.hfr`);
        return array;
    }


// Remove out directory if exists to make sure old files aren't kept
    if (fs.existsSync(dir_out)){
        console.log("dir out exists");
        rimraf.sync(dir_out);
    }

// Create out directories for Fbx
    if (!fs.existsSync(dir_out)) {
        fs.mkdirSync(dir_out);
    }

// Read Input Directory
    currFilesRead = fs.readdirSync(dir_in);
    currFilesRead.forEach( file => {
        let curSource = path.join(dir_in, file);
        let curExt = path.extname(curSource);
        let curBaseName = path.basename(curSource, curExt);
        avatarBaseFileName = curBaseName;
        if ( fs.lstatSync( curSource ).isDirectory() ) {
            if (curBaseName === fbxDirectoryName) {
                fileInputStore.fbx_directory = curSource
                fileInputStore.fbx_file = `${curBaseName}.fbx`
                fileInputStore.texture_directory = 
                    path.join(fileInputStore.fbx_directory, textureDirectoryName);
            }
        }
        if (curExt === '.fst') {
            fileInputStore.fst_directory = dir_in;
            fileInputStore.fst_file = file;
            fstFileRead = fs.readFileSync(
                path.join(fileInputStore.fst_directory, fileInputStore.fst_file), {"encoding": "ascii"});
        }
    })

// Grab The textures
    currFilesRead = fs.readdirSync(fileInputStore.texture_directory);
    currFilesRead.forEach( file => {
        fileInputStore.texture_files.push(file);
    })

// Run loop to create Avatars
while (currCount <= NUMBER_OF_AVATARS_NEEDED) {
    console.log(`Currently on Avatar ${currCount}`)
    // Create the curr Avatar Folders
    currentAvatarName = `${avatarBaseFileName}_${currCount}`;
    currentAvatarBasePath = 
        path.join(dir_out, currentAvatarName)
    currentAvatarFbxPath = 
        path.join(currentAvatarBasePath, currentAvatarName);
    currentAvatarTexturePath =  
        path.join(currentAvatarFbxPath, 'textures');
    currentFolderArray = [currentAvatarBasePath, currentAvatarFbxPath, currentAvatarTexturePath];
    currentFolderArray.forEach( folder => {
        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder);
        }
    })

    // Create new fst file
    currFstFile = baseFSTMaker(currCount, fstFileRead);
    fs.writeFileSync(path.join(currentAvatarBasePath, `${currentAvatarName}.fst`), currFstFile);

    /*###
    // Copy FBX Over
    copyFileSync(
        path.join(fileInputStore.fbx_directory, fileInputStore.fbx_file), 
        path.join(currentAvatarFbxPath, `${currentAvatarName}.fbx`));

    // Copy Textures Over
    fileInputStore.texture_files.forEach( file => {
        copyFileSync(path.join(fileInputStore.texture_directory, file), path.join(currentAvatarTexturePath, file));
    });

    /*
    // Manipulate the Textures
    currFilesRead = fs.readdirSync(fileInputStore.texture_directory);
    currFilesRead.forEach( file => {
        let curSource = path.join(fileInputStore.texture_directory, file);
        let curExt = path.extname(curSource);
        let curBaseName = path.basename(curSource, curExt);
        jimp.read(curSource)
            .then( (image) => {
            var innerCounter = 0;
                // console.log("randominit", getRandomInt(1,10));
                let manipArray = pickManips(getRandomInt(0,1));
                // console.log("manipArray", manipArray);
                let processmanips = processManip(manipArray)
                processmanips[0].forEach( manip => {
                    // console.log("manip.method", manip.method)
                    // console.log("manip.params[0]", manip.params[0])
                    let params = manip.params[0];
                    if (!params){
                        image[manip.method]();
                    } else {
                        image[manip.method](manip.params[0]);
                    }
                    innerCounter++
                })
                image.color(processmanips[1]);
            })
            .catch( (err) => {
                console.log(err);
            });
    });
    */

    // Create CSV file Entry
    csvDataArray.push(csvEntryMaker(currentAvatarName));
    currCount++
    }

createCSVFile(path.join(dir_out, 'data.csv'), csvDataArray);













