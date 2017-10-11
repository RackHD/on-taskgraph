'''
Copyright 2017 Dell Inc. or its subsidiaries. All Rights Reserved.

'''

import os
import sys
import subprocess
import test_common

# Select test group here using @attr
from nose.plugins.attrib import attr
@attr(all=True, regression=True, smoke=True)
class rackhd20_api_workflows(test_common.unittest.TestCase):
    def test_api_20_workflows(self):
        api_data = test_common.taskgraphapi("/api/2.0/workflows")
        self.assertEqual(api_data['status'], 200, 'Incorrect HTTP return code, expected 200, got:' + str(api_data['status']))
        for item in api_data['json']:
            # check required fields
            for subitem in ["id", "name","injectableName", "instanceId", "tasks"]:
                self.assertIn(subitem, item, subitem + ' field error')

    def test_api_20_workflows_tasks(self):
        data_payload = {
            "friendlyName": "Shell commands hwtest",
            "injectableName": "Task.Linux.Commands.Hwtest",
            "implementsTask": "Task.Base.Linux.Commands",
            "options": {
                "commands": [
                    {"command": "sudo /opt/test/hwtest",
                     "format": "json", "source": "hwtest"}
                ]
            },
            "properties": {"type": "hwtestRun"}
        }
        api_data = test_common.taskgraphapi("/api/2.0/workflows/tasks", action="put", payload=data_payload)
        self.assertEqual(api_data['status'], 201, 'Incorrect HTTP return code, expected 201, got:' + str(api_data['status']))

    def test_api_20_workflows_put_ipmi(self):
        data_payload = \
            {
                "friendlyName": "TestIPMI",
                "injectableName": 'Graph.Obm.Ipmi.CreateSettings.Test',
                "options": {
                    "obm-ipmi-task":{
                        "user": "rackhd",
                        "password": "rackhd"
                    }
                },
                "tasks": [
                    {
                        "label": "obm-ipmi-task",
                        "taskName": "Task.Obm.Ipmi.CreateSettings"
                    }
            ]
        }
        api_data = test_common.taskgraphapi("/api/2.0/workflows/graphs", action="put", payload=data_payload)
        self.assertEqual(api_data['status'], 201, 'Incorrect HTTP return code, expected 201, got:' + str(api_data['status']))
        api_data = test_common.taskgraphapi("/api/2.0/workflows/graphs/" + 'Graph.Obm.Ipmi.CreateSettings.Test')
        self.assertEqual(api_data['status'], 200, 'Incorrect HTTP return code, expected 200, got:' + str(api_data['status']))

if __name__ == '__main__':
    test_common.unittest.main()
