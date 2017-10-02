#!/usr/bin/python

import os
import subprocess

# Routine to parse the format of data returned by Arista Cli command:
# 'show version' and return in a JSON format
def parse_version(versionString):
    i = 0
    parsedString = ""

    # Remove blank lines and spaces
    versionString = os.linesep.join([s for s in versionString.splitlines() if s])
    versionString = versionString.replace(" ", "")

    numLines = versionString.count('\n')

    # Further parsing of data for JSON formatting
    for line in versionString.splitlines():
        emptyValue = False
        # Add quotes around key
        line = '"' + line
        line = line.replace(':', '":')

        # Add key for the Arista switch model
        if (line.find(':') == -1):
            emptyValue = True
            line = '"Hardwaremodel":' + line + '"'

        if (line.endswith(":")):
            line = line.replace(':', ':""')
        else:
            if emptyValue == False:
                # Add quotes around value
                line = line.replace(':', ':"')
                line = line + '"'

        # Add comma separators
        if i != numLines:
            line = line + ","

        # Adding curly braces for formatting
        if i == 0:
            line = "{" + line
        elif i == numLines:
            line = line + "}"

        parsedString += line
        i += 1

    return parsedString

def main():
    data = {}

    try:
        cmd = "Cli -c 'show version'"
        version = subprocess.check_output(cmd, shell=True)
        data = parse_version(version)
    except:
        pass

    return data

