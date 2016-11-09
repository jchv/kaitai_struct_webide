/// <reference path="../lib/ts-types/goldenlayout.d.ts" />
var baseUrl = location.href.split('?')[0].split('/').slice(0, -1).join('/') + '/';
var dataProvider;
var itree;
function compile(srcYaml, kslang, debug) {
    var src;
    try {
        src = YAML.parse(srcYaml);
    }
    catch (parseErr) {
        showError("YAML parsing error: ", parseErr);
        return;
    }
    try {
        var ks = io.kaitai.struct.MainJs();
        var rRelease = (debug === false || debug === 'both') ? ks.compile(kslang, src, false) : null;
        var rDebug = (debug === true || debug === 'both') ? ks.compile(kslang, src, true) : null;
        return rRelease && rDebug ? { debug: rDebug, release: rRelease } : rRelease ? rRelease : rDebug;
    }
    catch (compileErr) {
        console.log(compileErr.s$1);
        showError("KS compilation error: ", compileErr);
        return;
    }
}
$(() => {
    ui.infoPanel.getElement().show();
    ui.hexViewer.onSelectionChanged = () => {
        ui.infoPanel.getElement().text(ui.hexViewer.selectionStart == -1 ? 'no selection' : `selection: 0x${ui.hexViewer.selectionStart.toString(16)} - 0x${ui.hexViewer.selectionEnd.toString(16)}`);
        if (itree && ui.hexViewer.selectionStart) {
            var intervals = itree.search(ui.hexViewer.selectionStart);
            console.log('intervals', intervals);
        }
    };
    ui.hexViewer.onSelectionChanged();
    ui.genCodeDebugViewer.commands.addCommand({
        name: "compile",
        bindKey: { win: "Ctrl-Enter", mac: "Command-Enter" },
        exec: function (editor) { reparse(); }
    });
    initFileDrop('fileDrop', files => {
        Promise.all(files.map((file, i) => {
            var isKsy = file.file.name.toLowerCase().endsWith('.ksy');
            return (isKsy ? file.read('text') : file.read('arrayBuffer')).then(content => {
                if (files.length == 1) {
                    if (isKsy)
                        setKsy(content);
                    else
                        setInputBuffer(content).then(reparse);
                }
                return localFs.put(file.file.name, content);
            });
        })).then(refreshFsNodes);
    });
    function loadFsItem(fsItem) {
        if (!fsItem || fsItem.type !== 'file')
            return;
        return fss[fsItem.fsType].get(fsItem.fn).then(content => {
            if (fsItem.fn.toLowerCase().endsWith('.ksy'))
                return setKsy(content);
            else {
                localforage.setItem('inputFsItem', fsItem);
                return setInputBuffer(content, true);
            }
        });
    }
    ui.fileTreeCont.getElement().bind("dblclick.jstree", function (event) {
        loadFsItem(ui.fileTree.get_node(event.target).data);
    });
    //var lineInfo = null;
    //ui.parsedDataViewer.getSession().selection.on('changeCursor', (e1, e2) => {
    //    var lineIdx = e2.selectionLead.row;
    //    var debug = lineInfo ? lineInfo.lines[lineIdx] : null;
    //    if (debug && debug.start <= debug.end)
    //        ui.hexViewer.setSelection(debug.start, debug.end);
    //    else
    //        ui.hexViewer.deselect();
    //});
    function recompile() {
        var srcYaml = ui.ksyEditor.getValue();
        var compiled = compile(srcYaml, 'javascript', 'both');
        ui.genCodeViewer.setValue(compiled.release[0], -1);
        ui.genCodeDebugViewer.setValue(compiled.debug[0], -1);
        reparse();
    }
    function reparse() {
        return Promise.all([jailReady, inputReady, formatReady]).then(() => {
            var debugCode = ui.genCodeDebugViewer.getValue();
            return jailrun(`module = { exports: true }; \n ${debugCode} \n`);
        }).then(() => {
            console.log('recompiled');
            jail.remote.reparse((res, error) => {
                window['parseRes'] = res;
                console.log('reparse res', res);
                itree = new IntervalTree(dataProvider.length / 2);
                handleError(error);
                var jsTree = ui.parsedDataTreeCont.getElement();
                parsedToTree(jsTree, res, handleError).on('select_node.jstree', function (e, node) {
                    //console.log('select_node', node);
                    var debug = node.node.data.debug;
                    if (debug)
                        ui.hexViewer.setSelection(debug.start, debug.end - 1);
                });
                //var parsedJsonRes = parsedToJson(res);
                //lineInfo = parsedJsonRes.lineInfo;
                //console.log(lineInfo);
                //ui.parsedDataViewer.setValue(parsedJsonRes.json);
                //ui.hexViewer.setIntervals(parsedJsonRes.intervals);
            });
        });
    }
    //var load = { input: 'grad8rgb.bmp', format: 'image/bmp.ksy' };
    var load = { input: 'sample1.zip', format: 'archive/zip.ksy' };
    function setInputBuffer(fileBuffer, fromCache = false) {
        dataProvider = {
            length: fileBuffer.byteLength,
            get(offset, length) { return new Uint8Array(fileBuffer, offset, length); },
        };
        ui.hexViewer.setDataProvider(dataProvider);
        return jailrun('inputBuffer = args; void(0)', fileBuffer);
    }
    var inputReady = localforage.getItem('inputFsItem').then((fsItem) => {
        return loadFsItem(fsItem || { fsType: 'kaitai', fn: `samples/${load.input}`, type: 'file' });
    });
    var editDelay = new Delayed(500);
    ui.ksyEditor.on('change', () => editDelay.do(() => recompile()));
    function setKsy(ksyContent, fromCache = false) {
        if (!fromCache)
            localStorage.setItem('ksy', ksyContent);
        ui.ksyEditor.setValue(ksyContent, -1);
    }
    var cachedKsy = localStorage.getItem('ksy');
    var formatReady = Promise.resolve(cachedKsy ? cachedKsy : $.ajax({ url: `formats/${load.format}` })).then(ksy => setKsy(ksy, true));
});
//# sourceMappingURL=app.js.map