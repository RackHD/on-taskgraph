#!/usr/bin/python

import os
import subprocess

# Routine to parse the format of data returned by Arista Cli command: 'show snmp'
# and return in a python dictionary format
def parse_snmp_show(snmpString):
    i = 0
    nestedArray = 0
    parsedString = ""

    # Remove blank lines
    snmpString = os.linesep.join([s for s in snmpString.splitlines() if s])

    # Count the number of lines
    numLines = snmpString.count('\n')

    for line in snmpString.splitlines():
        number = False
        # Remove extra spaces to the left
        line = line.lstrip()

        # Find out if value is numeric. For 'snmp show', numeric values are listed
        # first on the lines, so need to swap it around and do other formatting
        if (line[0].isdigit()):
            number = True
            line = ":" + line
            firstSpace = line.find(' ')
            line = line[(firstSpace+1):] + line[:firstSpace]
            line = line.replace(':', '":')
        else:
            line = line.replace(':', '":"')

        # More formatting - check whether nested array or not
        if (line.find(':') != -1):
            line = '"' + line
            if (number == False):
                line = line + '"'
        else:
            line = '"' + line + '":{'
            nestedArray = 0

        # Removing extra spaces
        line = line.replace(" ", "")

        # Further parsing of data for JSON formatting
        if i == 0:
            line = '{' + line + ','
        elif i == numLines:
            line = line + '}'
        else:
            # I wish this wasn't so ugly, but the returned data here is hard to
            # parse and specific to this one Cli command. Maybe find a better way
            # later.  The if statement below is for the 'Access Control' array
            # within 'show snmp'
            if (nestedArray == 3 and i != 3):
                line = line + '}'

            # Add comma as long as not the start of nested array
            if (line.endswith('{') == False):
                line = line + ','

        parsedString += line
        i += 1
        nestedArray += 1

    return parsedString


# Routine to parse the format of data returned by Arista Cli commands:
# 'show snmp community', 'show snmp group', etc and
# return in a python dictionary format
def parse_snmp(snmpString):
    i = 0
    parsedString = ""

    # Remove blank lines and spaces
    snmpString = os.linesep.join([s for s in snmpString.splitlines() if s])
    snmpString = snmpString.replace(" ", "")

    numLines = snmpString.count('\n')

    # Further parsing of data for JSON formatting
    for line in snmpString.splitlines():
        if i == 0:
            line = '{"' + line + '",'
        elif i == numLines:
            line = '"' + line + '"}'
        else:
            line = '"' + line + '",'

        line = line.replace(':', '":"')
        parsedString += line
        i += 1

    return parsedString

# Routine to parse the format of data returned by Arista Cli command: 'show snmp host'
# and return in a python dictionary format
def parse_snmp_host(snmpString):
    i = 0
    parsedString = ""

    # Replace multiple spaces with a new line
    snmpString = snmpString.replace('  ', '\n')

    # Remove blank lines and spaces
    snmpString = os.linesep.join([s for s in snmpString.splitlines() if s])
    snmpString = snmpString.replace(" ", "")

    numLines = snmpString.count('\n')

    # Further parsing of data for JSON formatting
    for line in snmpString.splitlines():
        # Pick off value to see if it is numeric or not
        value = line.split(":")[1]

        if i == 0:
            line = '{"' + line + '",'
        elif i == numLines:
            line = '"' + line + '"}'
        else:
            if (value.isdigit()):
                line = '"' + line + ','
            else:
                line = '"' + line + '",'

        if (value.isdigit()):
            line = line.replace(':', '":')
        else:
            line = line.replace(':', '":"')

        parsedString += line
        i += 1

    return parsedString

def main():
    data = {}

    try:
        cmd = "Cli -c 'show snmp'"
        snmp = subprocess.check_output(cmd, shell=True)
        data['snmp'] = parse_snmp_show(snmp)
    except:
        pass

    try:
        cmd = "Cli -c 'show snmp community'"
        community = subprocess.check_output(cmd, shell=True)
        data['community'] = parse_snmp(community)
    except:
        pass

    try:
        cmd = "Cli -c 'show snmp host'"
        host = subprocess.check_output(cmd, shell=True)
        data['host'] = parse_snmp_host(host)
    except:
        pass

    try:
        cmd = "Cli -c 'show snmp group'"
        group = subprocess.check_output(cmd, shell=True)
        data['group'] = parse_snmp(group)
    except:
        pass

    return data

