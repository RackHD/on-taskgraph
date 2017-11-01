'''
Copyright 2017 Dell Inc. or its subsidiaries. All Rights Reserved.

'''

import os
import sys
import subprocess
import test_common
from pymongo import MongoClient

# Select test group here using @attr
from nose.plugins.attrib import attr
@attr(all=True, regression=True, smoke=True)
class rackhd20_api_tasks(test_common.unittest.TestCase):

    def test_api_20_tasks_bootstraps(self):
        node = {
            "identifiers": ["FF:FF:FF:FF:FF:FF"],
            "name": "FF:FF:FF:FF:FF:FF",
            "relations": [],
            "tags": [],
            "type": "compute"
        }

        client = MongoClient('localhost', 27017)
        db = client.rackhd
        db.nodes.insert(node)
        count = db.nodes.count()
        computeNode = db.nodes.find_one({"type": "compute"})
        print computeNode
        mac = computeNode["identifiers"][0]

        #Expecting a valid content
        api_data = test_common.taskgraphapi("/api/2.0/tasks/bootstrap.js"+"?macAddress="+mac)
        self.assertEqual(api_data['status'], 200, "Was expecting code 200. Got " + str(api_data['status']))
        self.assertNotEqual(api_data['text'], "Not Found", "Was expecting a valid content" )

        # Expecting a invalid content
        api_data = test_common.taskgraphapi("/api/2.0/tasks/invalidContent"+"?macAddress="+mac)
        self.assertEqual(api_data['status'], 404, "Was expecting code 404. Got " + str(api_data['status']))
        self.assertEqual(api_data['text'], "Not Found\n")

    def test_api_20_tasks_identifier(self):
        api_data = test_common.taskgraphapi("/api/2.0/tasks/InvalidTaskID")
        self.assertEqual(api_data['status'], 404, "Was expecting code 404. Got " + str(api_data['status']))

if __name__ == '__main__':
    test_common.unittest.main()
