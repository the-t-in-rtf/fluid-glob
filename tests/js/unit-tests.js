"use strict";
var fluid  = require("infusion");
var jqUnit = require("node-jqunit");

require("../../");

jqUnit.module("Unit tests for fluid-glob package.");

jqUnit.test("Test positive and negative pattern filtering.", function () {
    var testDefs = {
        empty: {
            message: "An empty array should be preserved",
            input: [],
            expectedPositive: [],
            expectedNegative: []
        },
        mixed: {
            message: "An array of mixed entries should be filtered as expected",
            input: ["!negative", "positive"],
            expectedPositive: ["positive"],
            expectedNegative: ["negative"]
        }
    };

    fluid.each(testDefs, function (testDef) {
        var positives = fluid.glob.positivePatterns(testDef.input);
        jqUnit.assertDeepEq(testDef.message + ": positive matches", testDef.expectedPositive, positives);

        var negatives = fluid.glob.negativePatterns(testDef.input);
        jqUnit.assertDeepEq(testDef.message + ": negative matches", testDef.expectedNegative, negatives);
    });
});

jqUnit.test("Test pattern validity checks.", function () {
    var validPatterns   = [
        "./src/**/*.js",
        "!./src/**/*.js",
        "./full/path/to/file.js",
        "./relative/path/to/file.js",
        "./src/../filename.js"
    ];
    var invalidPatterns = [
        "./**",
        "./**/*.js",
        "**",
        "**/*.js",
        "!**/*.js",
        "!./**/*.js",
        "../filename.js",
        "./(this|that)/**/*.js"
    ];

    // Scan valid patterns with the default rules.
    fluid.each(validPatterns, function (validPattern) {
        var violations = fluid.glob.validatePattern(validPattern);
        jqUnit.assertTrue("A valid pattern should be valid.", violations.length === 0);
    });

    // Scan invalid patterns with the default rules.
    fluid.each(invalidPatterns, function (invalidPattern) {
        var violations = fluid.glob.validatePattern(invalidPattern);
        jqUnit.assertTrue("An invalid pattern should not be valid.", violations.length > 0);
    });

    var strictRules = {
        rejectAll: {
            message: "contains one or more characters",
            pattern: /.+/
        }
    };

    // Scan valid patterns with custom rules that make them invalid.
    fluid.each(validPatterns, function (validPattern) {
        var violations = fluid.glob.validatePattern(validPattern, strictRules);
        jqUnit.assertTrue("We should be able to add a custom rule when checking validity.", violations.length > 0);
    });

    var noRules = {};

    // Scan invalid patterns with custom rules that disable all checks.
    fluid.each(invalidPatterns, function (invalidPattern) {
        var violations = fluid.glob.validatePattern(invalidPattern, noRules);
        jqUnit.assertTrue("We should be able to remove default rules when testing validity.", violations.length === 0);
    });
});

jqUnit.test("Test single pattern matching.", function () {
    var testDefs = {
        filenameWildcard: {
            message:  "We should be able to match based on filename wildcards.",
            positive: ["filename.js", "other.js"],
            negative: ["README.md", "UPPERCASE.JS"],
            pattern:  "*.js"
        },
        leadingDot: {
            message:  "We should be able to match filenames with a leading dot.",
            positive: [".gitignore", ".eslintrc.json"],
            negative: ["README.md", "filename.js"],
            pattern:  ".*"
        },
        dirWildCard: {
            message: "We should be able to match based on directory wildcards.",
            positive: ["./src/deep/path/filename.js", "./src/shallow.js"],
            negative: ["./root.js", "./lib/filename.js", "./lib/deep/src/filename.js"],
            pattern: "./src/**/*.js"
        },
        multipleDirWildcards: {
            message: "We should be able to match based on multiple directory wildcards.",
            positive: ["./src/lib/filename.js", "./src/deep/lib/filename.js"],
            negative: ["./src/filename.js", "./lib/src/filename.js", "./src/deep/filename.js"],
            pattern: "./src/**/lib/*.js"
        },
        fullPath: {
            message: "We should be able to handle full paths.",
            positive: ["/path/to/filename.js"],
            negative: ["filename.js", "path/to/filename.js"],
            pattern: "/path/to/filename.js"
        },
        relativePath: {
            message: "We should be able to handle relative paths.",
            positive: ["relative/path/to/content.txt"],
            negative: ["./relative/path/to/content.txt", "/relative/path/to/content.txt"],
            pattern: "relative/path/to/content.txt"
        }
    };

    fluid.each(testDefs, function (testDef) {
        fluid.each(fluid.makeArray(testDef.positive), function (shouldMatch) {
            jqUnit.assertTrue(testDef.message + ": positive matching", fluid.glob.matchesSinglePattern(shouldMatch, testDef.pattern));
        });

        fluid.each(fluid.makeArray(testDef.negative), function (shouldNotMatch) {
            jqUnit.assertFalse(testDef.message + ": negative matching", fluid.glob.matchesSinglePattern(shouldNotMatch, testDef.pattern));
        });
    });
});

jqUnit.test("Test `sanitisePath` function", function () {
    var testDefs = {
        fullWindows: {
            message:  "We should be able to handle a full windows path, including backslashes.",
            input:    "c:\\path\\to\\filename.js",
            expected: "/path/to/filename.js"
        },
        halfWindows: {
            message:  "We should be able to handle a 'half' windows path, with a drive letter, but leading slashes.",
            input:    "c:/path/to/filename.js",
            expected: "/path/to/filename.js"
        },
        windowsRoot: {
            message:  "We should be able to handle a drive root",
            input:    "c:\\",
            expected: "/"
        },
        nonWindows: {
            message:  "We should be able to handle a non-windows path.",
            input:    "/path/to/filename.js",
            expected: "/path/to/filename.js"
        }
    };

    fluid.each(testDefs, function (testDef) {
        var output = fluid.glob.sanitisePath(testDef.input);
        jqUnit.assertEquals(testDef.message, testDef.expected, output);
    });
});

jqUnit.test("Test `addPathToPatterns` function.", function () {
    var testDefs = {
        withLeadingDot: {
            message: "We should be able to handle relative paths with a leading dot.",
            rootPath: "/root",
            patterns: ["./path/to/filename.js", "./README.md", "!./.gitignore"],
            expected: ["/root/path/to/filename.js", "/root/README.md", "!/root/.gitignore"]
        },
        withoutLeadingDot: {
            message: "We should be able to handle relative paths without a leading dot.",
            rootPath: "/root",
            patterns: ["path/to/filename.js", "!path/to/lib/filename.js"],
            expected: ["/root/path/to/filename.js", "!/root/path/to/lib/filename.js"]
        },
        fullPath: {
            message: "We should be able to handle full paths.",
            rootPath: "/root",
            patterns: ["/otherRoot/path/to/filename.js", "!/otherRoot/exclude.js"],
            expected: ["/otherRoot/path/to/filename.js", "!/otherRoot/exclude.js"]
        },
        onlyFilename: {
            message: "We should be able to handle a path that only consists of a filename.",
            rootPath: "/root",
            patterns: ["README.md", "!.gitignore"],
            expected: ["README.md", "!.gitignore"]
        }
    };

    fluid.each(testDefs, function (testDef) {
        var output = fluid.glob.addPathToPatterns(testDef.rootPath, testDef.patterns);
        jqUnit.assertDeepEq(testDef.message, testDef.expected, output);
    });
});

jqUnit.test("Test `dirMightMatch` function.", function () {
    var testDefs = {
        filenameWildcard: {
            message: "We should be able to match a pattern that contains filename globbing.",
            pattern: "/root/path/*.js",
            hits:    ["/root/path"],
            misses:  ["/root/other/path"]
        },
        dirWildCard: {
            message: "We should be able to match a pattern that contains directory globbing.",
            pattern: "/root/src/**/*.js",
            hits:    ["/root/src", "/root/src/js"],
            misses:  ["/root/tests", "/root/node_modules/module/src"]
        }
    };

    fluid.each(testDefs, function (testDef) {
        fluid.each(testDef.hits, function (shouldMatch, index) {
            var matches = fluid.glob.dirMightMatch(shouldMatch, testDef.pattern);
            jqUnit.assertTrue(testDef.message + ": hit " + index, matches);
        });
        fluid.each(testDef.misses, function (shouldNotMatch, index) {
            var matches = fluid.glob.dirMightMatch(shouldNotMatch, testDef.pattern);
            jqUnit.assertFalse(testDef.message + ": miss " + index, matches);
        });
    });
});
