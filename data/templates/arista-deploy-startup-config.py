#!/usr/bin/python

def main():
    import subprocess

    cmd = "Cli -p2 -c 'copy <%=startupConfigUri%> flash:startup-config'"
    subprocess.check_output(cmd, shell=True)

