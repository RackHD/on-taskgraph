# Copyright 2016, EMC, Inc.

"""
Download and execute python scripts from the RackHD tasks api in a loop
"""

import json
import sys
from time import sleep


class _Urllib2(object):

    def __init__(self):
        pass

    @staticmethod
    def download_task_data():
        """
        Download a python script from the tasks API
        """
        _task_data = urllib2.urlopen(TASKS_URI).read()
        poc_log("Downloading task data")
        poc_log("_task_data: {0}".format(_task_data))

        return json.loads(_task_data)

    @staticmethod
    def download_script(_downloadUrl):
        """
        Download a python script from downloadUrl
        """
        poc_log("Downloading script at {}".format(_downloadUrl))
        script = urllib2.urlopen(_downloadUrl).read()
        poc_log("{0}".format(script))
        with open('script.py', 'w') as rackhd_script:
            rackhd_script.write(script)

    @staticmethod
    def create_post_request(_task_data, _json_content_type):
        poc_log("Create post request\n {}".format(_task_data))
        _task_data = json.dumps(_task_data)
        _req = urllib2.Request(TASKS_URI, _task_data, _json_content_type)
        return _req

    @staticmethod
    def post_task_data(_req):
        poc_log("Posting task data\n")
        urllib2.urlopen(_req)


class _Requests(object):

    def __init__(self):
        pass

    @staticmethod
    def download_task_data():
        """
        Download a python script from the tasks API
        """
        poc_log("Downloading task data")
        session = requests.Session()
        response = session.get(TASKS_URI, auth=("", ""))
        _task_data = response.text
        session.close()
        poc_log("_task_data: {0}".format(_task_data))
        return json.loads(_task_data)

    @staticmethod
    def download_script(_downloadUrl):
        """
        Download a python script from downloadUrl
        """
        session = requests.Session()
        poc_log("Downloading script at {}".format(_downloadUrl))
        script = session.get(_downloadUrl, auth=("", ""))
        session.close()
        poc_log("{0}".format(script))
        with open('script.py', 'w') as rackhd_script:
            rackhd_script.write(script.text)

    @staticmethod
    def create_post_request(_task_data, _json_content_type):
        poc_log("Create post request\n {}".format(_task_data))
        _task_data = json.dumps(_task_data)
        session = requests.Session()
        req = session.post(TASKS_URI, data=_task_data, auth=("", ""), headers=_json_content_type)
        session.close()
        return req

    @staticmethod
    def post_task_data(_req):
        poc_log("Posting task data\n")
        session = requests.Session()
        session.get(_req)
        session.close()


def poc_log(info):
    if log_filename:
        poc_log_file.write("taskrunner.py: ")
        poc_log_file.write(info)
        poc_log_file.write("\n")
        poc_log_file.flush()
    print "poc_log: " + info
    sys.stdout.flush()

def poc_log_open():
    if log_filename:
        return open(log_filename, "a+")

def poc_log_close():
    if log_filename:
        poc_log_file.close()

try:
    import requests
    switch_class = _Requests()
    log_filename = ""
except:
    import urllib2
    switch_class = _Urllib2()
    log_filename = "/bootflash/poap.log"


TASK_REQUEST_PERIOD = 5
TASKS_URI = 'http://<%=server%>:<%=port%>/api/2.0/tasks/<%=identifier%>'

json_content_type = {"Content-Type": "application/json"}

# setup log file and associated utils
poc_log_file = poc_log_open()

while True:
    try:
        task_data = switch_class.download_task_data()
    except Exception as e:
        poc_log("Failed to download task data, sleeping for {} seconds".format(TASK_REQUEST_PERIOD))
        sleep(TASK_REQUEST_PERIOD)
        continue

    for task in task_data['tasks']:
        try:
            switch_class.download_script(task['downloadUrl'])
            script_locals = {}

            poc_log("Execute Script")
            execfile('./script.py', script_locals)
            script_main = script_locals['main']

            # TODO: support task_data['result'] on the server-side since this isn't
            #       really stdout...
            result = script_main()
            # Yes, this gets json dumped again, but the server will treat it as
            # stringified JSON so make it easy for the server
            task['stdout'] = json.dumps(result)
            poc_log("result: {0}".format(task['stdout']))
        except Exception as error:
            poc_log("Failure running task {}".format(error))
            task['error'] = str(error)
            break

    try:
        if "exit" in task_data.keys():
            poc_log("Task execution complete")
            sys.exit(int(task_data["exit"]))
        req = switch_class.create_post_request(task_data, json_content_type)
    except Exception as error:
        task_data = [{'error': str(error)}]
        req = switch_class.create_post_request(task_data, json_content_type)

    for _ in range(3):
        try:
            switch_class.post_task_data(req)
        except urllib2.URLError:
            poc_log("Post Failed, sleeping")
            sleep(TASK_REQUEST_PERIOD)
            continue
        break

    sleep(TASK_REQUEST_PERIOD)
poc_log_close()
