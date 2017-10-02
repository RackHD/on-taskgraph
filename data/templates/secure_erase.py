#!/usr/bin/env python

# Copyright 2016, EMC, Inc.

# -*- coding: UTF-8 -*-

"""
This script is to do Secure Erase (SE) on a compute node
Four methods/tools are integrated in this scripts
A log file will be created for each disk to be erased named after disk name, like sdx.log
"""

import os
import sys
import re
import subprocess
import argparse
import time
import json
from multiprocessing import Pool
from multiprocessing import cpu_count
from filecmp import cmp as file_compare

ARG_PARSER = argparse.ArgumentParser(description='RackHD secure-erase argument')

ARG_PARSER.add_argument("-i", action="store", default='undefined', type=str,
                        help="Secure erase taskId")

ARG_PARSER.add_argument("-s", action="store", default='', type=str,
                        help="RackHD host server address")

ARG_PARSER.add_argument("-d", action="append", default=[], type=str,
                        help="Disks to be erased with arguments")

ARG_PARSER.add_argument("-v", action="store", default="lsi", type=str,
                        help="RAID controller vendor info")

ARG_PARSER.add_argument("-t", action="store", type=str,
                        help="Specify secure erase tool, "
                             "scrub, hdpram, sg_format, sg_sanitize are supported")

ARG_PARSER.add_argument("-o", action="store", type=str,
                        help='Specify SE options. '
                             'For SG_format SE options, "0"/"1" are supported, '
                             'stands for erasing/not erasing GLIST.\n '
                             'For scrub SE options, "nnsa", "dod", "fillzero", '
                             '"random", "random2", "fillff", "gutmann", "schneier", '
                             '"fastold", "pfitzner7", "pfitzner33", "usarmy", '
                             '"old", "fastold" and "custom=string" are supported.'
                             'Please read scrub man page for more details. \n'
                             'For sg_sanitize SE options, "block", "crypto", "fail" are supported. '
                             'Overwrite option is not supported at current stage. '
                             'Please read tool man page for more details \n'
                             'For hdparm, "security-erase" and "security-erase-enhanced" \n'
                             'are supported')

ARG_LIST = ARG_PARSER.parse_args()

RAID_VENDOR_LIST = {
    "lsi": "/opt/MegaRAID/storcli/storcli64",
    "dell": "/opt/MegaRAID/perccli/perccli64"
}
SE_PASSWORD = "rackhd_secure_erase"
FRONT_SKIP = "4096"
HDPARM_RETRY_EXITCODES = [5]
COMMAND_LOG_MARKER = "\n==========================" \
                     "==========================\n"
if os.getcwd()[-1] != '/':
    PATH = os.getcwd() + "/"
else:
    PATH = os.getcwd()


class Progress(object):
    """
    Secure erase job progress class.
    """

    def __init__(self, disks, path, parameters):
        self.parameters = {                     # parameters parsed from command
            "taskId": parameters["taskId"],     # task id for notification
            "address": parameters["address"],   # rackhd server address
            "tool": parameters["tool"],         # erase tool to be used
            "option": parameters["option"]      # erase command arguments options
        }
        self.disk_list = disks  # disks to be erased
        self.interval = 60      # erase progress polling interval in seconds
        self.percent = 0.0      # last progress percent buffer
        self.duration = {}      # erase duration for each disks
        self.path = path        # log file path

    def scrub_parser(self, drive):
        """
        Secure erase job progress parser for scrub tool.
        :param drive: drive name
        :return: a float digital of percentage
        """
        # Scrub version 2.5.2-2 example:
        # scrub /dev/sdf
        # scrub: using NNSA NAP-14.1-C patterns
        # scrub: please verify that device size below is correct!
        # scrub: scrubbing /dev/sdf1 1995650048 bytes (~1GB)
        # scrub: random  |................................................|
        # scrub: random  |................................................|
        # scrub: 0x00    |................................................|
        # scrub: verify  |................................................|

        # Maximum dot count for each pass
        log = open(self.path + drive + '.log', 'r')
        MAX_DOT_COUNT = 50
        # Scrub pass counts for different scrub methods, default pass count is 1
        pass_count_key = self.parameters["option"] or "nnsa"
        pass_counts = {"nnsa": 4, "dod": 4, "gutmann": 35, "schneier":7, "pfitzner7":7,
                       "pfitzner33": 33, "usarmy": 3, "random2": 2, "old": 6, "fastold": 5}
        pass_count = pass_counts.get(pass_count_key, 1)
        line_count = 0
        dot_count = 0
        patterna = re.compile("^scrub: \w{4,6}\s*\|\.+\|$")
        patternb = re.compile("^scrub: \w{4,6}\s*\|\.*$")
        for line in log.readlines():
            line = line.strip()
            if patterna.match(line):
                line_count += 1
            elif patternb.match(line):
                dot_count = len(line.split("|")[1])
        percent = 100.00*(line_count*MAX_DOT_COUNT + dot_count)/(pass_count*MAX_DOT_COUNT)
        log.close()
        return percent

    def __get_hdparm_duration(self, log):
        """
        Get hdparm required secure erase time.
        :param log: a file object of secure erase log
        :return: required secure erase time indicated by hdparm tool
        """
        pattern = re.compile("(\d{1,4})\s*min for SECURITY ERASE UNIT." +
                             "\s*(\d{1,4})\s*min for ENHANCED SECURITY ERASE UNIT.", re.I)
        estimated_time = 0
        for line in log.readlines():
            line = line.strip()
            match = pattern.match(line)
            if match:
                if self.parameters["option"] == "security-erase":
                    estimated_time = match.group(1)
                else:
                    estimated_time = match.group(2)
        return float(estimated_time)

    def hdparm_parser(self, drive):
        """
        Secure erase job progress parser for scrub tool.
        :param drive: drive name
        :return: a float digital of percentage
        """
        self.parameters["option"] = self.parameters["option"] or "security-erase"
        log = open(self.path + drive + '.log', 'r')
        percent = 0.0
        if not self.duration.has_key(drive) or self.duration[drive] == 0:
            self.duration[drive] = self.__get_hdparm_duration(log)
        if self.duration[drive] != 0:
            percent = self.percent + 100.0*self.interval/(self.duration[drive]*60.00)
            # As hdparm SE duration is estimated, there might be percent larger than 100
            # Let maximum precent to be 99.00 instead
            if percent > 99.00:
                percent = 99.00
        log.close()
        return percent

    def __sg_requests_parser(self, drive):
        """
        Secure erase job progress parser for sg_format and sg_sanitize tools.
        :param drive: drive name
        :return: a float digital of percentage
        """
        patterna = re.compile("Progress indication:\s+(\d{1,3}\.\d{1,3})\% done")
        cmd = ['sg_requests', '--progress', '/dev/' + drive]
        for i in range(2):
            try:
                progress_output = subprocess.check_output(cmd, shell=False)
                break
            except subprocess.CalledProcessError:
                progress_output = ''
        if progress_output:
            match = patterna.match(progress_output)
            if match:
                return float(match.group(1))
        elif self.percent > 0:
            return self.percent
        return 0.00

    def sg_format_parser(self, drive):
        """
        Secure erase job progress parser for sg_format tool.
        :param drive: drive name
        :return: a float digital of percentage
        """
        return self.__sg_requests_parser(drive)

    def sg_sanitize_parser(self, drive):
        """
        Secure erase job progress parser for sg_sanitize tool.
        :param drive: drive name
        :return: a float digital of percentage
        """
        #return float('+inf')
        return self.__sg_requests_parser(drive)

    def __run(self):
        """
        Get secure erase progress for secure erase task.
        """
        parser_mapper = {
            "hdparm": self.hdparm_parser,
            "scrub": self.scrub_parser,
            "sg_format": self.sg_format_parser,
            "sg_sanitize": self.sg_sanitize_parser
        }
        disk_count = len(self.disk_list)
        percentage_list = [0.0]*disk_count
        erase_start_flags = [False]*disk_count
        payload = {
            "taskId": self.parameters["taskId"],
            "value": 0,
            "maximum": 100
        }
        counter = 0
        total_percent = 0.00
        if not self.parameters["address"]:
            self.parameters["address"] = \
                "http://172.31.128.1:9080/api/current/notification/progress"
        while True:
            for (index, value) in enumerate(self.disk_list):
                value = value.split("/")[-1]
                if erase_start_flags[index]:
                    # Check if secure erase sub-progress is alive
                    command = 'ps aux | grep {} | grep {} | sed "/grep/d" | sed "/python/d"' \
                        .format(self.parameters["tool"], value)
                    erase_alive = subprocess.check_output(command, shell=True)
                    if not erase_alive:
                        percentage_list[index] = 100
                    else:
                        self.percent = percentage_list[index]
                        percentage_list[index] = parser_mapper[self.parameters["tool"]](value)
                else:
                    erase_start_flags[index] = os.path.exists(self.path + value + '.log')
            total_percent = sum(percentage_list)/disk_count
            if total_percent == float('+inf'):
                payload["percentage"] = "Not Available"
            else:
                payload["percentage"] = str("%.2f" % total_percent) + "%"
                payload["value"] = int(total_percent)
            counter += 1
            payload["description"] = "This is the {}th polling with {}s interval" \
                .format(str(counter), str(self.interval))
            cmd = 'curl -X POST -H "Content-Type:application/json" ' \
                '-d \'{}\' {}'.format(json.dumps(payload), self.parameters["address"])
            try:
                subprocess.call(cmd, shell=True)
            except subprocess.CalledProcessError as err:
                print err.output
            if total_percent == 100:
                break
            time.sleep(self.interval)

    def run(self):
        """
        Get secure erase progress for secure erase task with try except to catch errors
        """
        try:
            self.__run()
        except Exception as err:
            return {"exit_code": -1, "message":  err}
        else:
            return {"exit_code": 0, "message": "Progress succeeded"}


def create_jbod(disk_arg, raid_tool):
    """
    Create JBOD for each physical disk under a virtual disk.
    :param disk_arg: a dictionary contains disk argument
    :param raid_tool: tools used for JBOD creation, storcli and perccli are supported
    :return: a list contains disk OS names, like ["/dev/sda", "/dev/sdb", ...]
    """
    for slot_id in disk_arg["slotIds"]:
        cmd = [raid_tool, slot_id, "set", "jbod"]
        subprocess.check_output(cmd, shell=False)
    disk_list_with_jbod = []

    # scsi id is used to map virtual disk to new JBOD
    # scsi id is made up of adapter:scsi:dev:lun as below:
    #   adapter id [host]: controller ID, ascending from 0.
    #       Usually c0 for one controller in server Megaraid info
    #   scsi id [bus]: a number of 0-15.
    #       Usually different for RAID(like 2) and JBOD(like 0)
    #   device id [target]: displayed as DID in Megaraid for each physical drives.
    #   LUN id [LUN]: Logic Unit Numbers, LUN is not used for drive mapping
    scsi_id_bits = disk_arg["scsiId"].split(":")
    scsi_id_bits[-1] = ""  # LUN ID is ignored
    # map jbod to disk device name with JBOD
    for device_id in disk_arg["deviceIds"]:
        scsi_info = scsi_id_bits[:]
        scsi_info[2] = str(device_id)
        anti_patten = re.compile(":".join(scsi_info))  # anti-patten to exclude scsi id for RAID
        scsi_info[1] = '[0-9]{1,2}'  # scsi id should be a number of 0-15
        patten = re.compile(":".join(scsi_info))
        cmd = ["ls", "-l", "/dev/disk/by-path"]

        # Retry 10 times in 1 second before OS can identify JBOD
        for i in range(10):
            time.sleep(0.1)
            try:
                lines = subprocess.check_output(cmd, shell=False).split("\n")
            except subprocess.CalledProcessError:
                continue
            # example for "ls -l /dev/disk/by-path" console output
            #   total 0
            #   drwxr-xr-x 2 root root 300 May 19 03:15 ./
            #   drwxr-xr-x 5 root root 100 May 16 04:43 ../
            #   lrwxrwxrwx 1 root root   9 May 19 03:06 pci-0000:06:00.0-scsi-0:2:0:0 -> ../../sdf
            #   lrwxrwxrwx 1 root root  10 May 19 03:06 pci-0000:06:00.0-scsi-0:2:0:0-part1 ->
            #   ../../sdf1
            #   lrwxrwxrwx 1 root root  10 May 19 02:31 pci-0000:06:00.0-scsi-0:2:1:0 -> ../../sda
            disk_name = ''
            for line in lines:
                if patten.search(line) and not anti_patten.search(line) and line.find("part") == -1:
                    disk_name = line.split("/")[-1]
                    break
            if disk_name:
                break

        assert disk_name, "Disk OS name is not found for deviceId " + str(device_id)
        disk_list_with_jbod.append("/dev/" + disk_name)
    return disk_list_with_jbod


def convert_raid_to_jbod():
    """
    To delete RAID and create JBOD for each physical disk of a virtual disk with RAID
    :rtype : list
    :return: a string includes all the disks to be erased
    """

    disk_argument_list = []
    raid_controller_vendor = ""
    disk_list_without_raid = []
    # ARG_LIST.d should include at least following items as a string
    #   {
    #   "diskName": "/dev/sdx"
    #   "slotIds": ["/c0/e252/sx"]
    #   "deviceIds": [0]
    #   "virtualDisk": "/c0/vx"
    #   "scsiId": "0:0:0:0"
    #   }
    for arg in ARG_LIST.d:
        disk_argument_list.append(json.loads(arg))
    assert disk_argument_list != [], "no disk arguments includes"

    for disk_argument in disk_argument_list:
        # if virtualDisk doesn't exit, push disk directly into disk list
        if not disk_argument["virtualDisk"]:
            # disk_list_without_raid.append("/dev/" + disk_argument["diskName"])
            disk_list_without_raid.append(disk_argument["diskName"])
        else:
            # Idenfity tools used for raid operation
            # Tool will be validated once and only when RAID exists
            if not raid_controller_vendor:
                raid_controller_vendor = ARG_LIST.v or "lsi"
                assert raid_controller_vendor in RAID_VENDOR_LIST.keys(), \
                    "RAID controller vendor info is invalid"
                raid_tool = RAID_VENDOR_LIST[raid_controller_vendor]
                assert os.path.exists(raid_tool), "Overlay doesn't include tool path: " + raid_tool
            command = [raid_tool, "/c0", "set", "jbod=on"]
            subprocess.check_output(command, shell=False)
            command = [raid_tool, disk_argument["virtualDisk"], "del", "force"]
            subprocess.check_output(command, shell=False)
            disk_list_without_raid += create_jbod(disk_argument, raid_tool)
    return disk_list_without_raid


def robust_check_call(cmd, log):
    """
    Subprocess check_call module with try-except to catch CalledProcessError
    Real time command output will be written to log file.
    :rtype : dict
    :param cmd: command option for subprocess.check_call, an array
    :param log: an opened file object to store stdout and stderr
    :return: a dict include exit_code and message info
    """
    assert isinstance(cmd, list), "Input commands is not an array"
    exit_status = {"exit_code": 0, "message": "check_call command succeeded"}
    log.write(COMMAND_LOG_MARKER + "[" + " ".join(cmd) + "] output:\n")
    log.flush()  # Align logs
    try:
        exit_code = subprocess.check_call(cmd, shell=False, stdout=log, stderr=log)
    except subprocess.CalledProcessError as exc:
        exit_status["message"] = exc.output
        exit_status["exit_code"] = exc.returncode
    else:
        exit_status["exit_code"] = exit_code
    return exit_status


def robust_check_output(cmd, log):
    """
    Subprocess check_output module with try-except to catch CalledProcessError
    Command output will be written to log file after commands finished
    :param cmd: command option for subprocess.check_output, an array
    :param log: an opened file object to store stdout and stderr
    :return: a dict include exit_code and command execution message
    """
    assert isinstance(cmd, list), "Input commands is not an array"
    exit_status = {"exit_code": 0, "message": "check_output command succeeded"}
    log.write(COMMAND_LOG_MARKER + "[" + " ".join(cmd) + "] output:\n")
    log.flush()  # Align logs
    try:
        output = subprocess.check_output(cmd, shell=False, stderr=log)
    except subprocess.CalledProcessError as exc:
        exit_status["message"] = exc.output
        exit_status["exit_code"] = exc.returncode
    else:
        exit_status["message"] = output
        log.write(str(exit_status) + "\n")
        log.flush()  # Align logs
    return exit_status


def get_disk_size(disk_name, log, mark_files):
    """
    Get disk size and create empty mark files
    :param disk_name: disk name that be copied data to.
    :param log: an opened file object to store stdout and stderr
    :return: a string of disk size
    """
    # Filler drive size info from "fdisk -l /dev/sdx" commands
    command = ["fdisk", "-l", disk_name]
    disk_info = robust_check_output(command, log)
    assert disk_info["exit_code"] == 0, "Can't get drive %s size info" % disk_name
    output = disk_info["message"]
    # Output example for the line contains disk size info:
    # Disk /dev/sdx: 400.1 GB, 400088457216 bytes
    disk_size = "0"
    pattern = re.compile(r".*%s.* (\d{10,16}) bytes" % disk_name)
    # Match disk with size from 1G to 1P
    for line in output.split("\n"):
        match_result = pattern.match(line)
        if pattern.match(line):
            disk_size = match_result.group(1)
            break
    assert disk_size != "0", "Disk size should not be 0"
    for name in mark_files:
        try:
            os.mknod(name)
        except OSError:  # if file exits, ignore OSError
            continue
    return disk_size


def mark_on_disk(disk_name, log, flag, back_skip, mark_files):
    """
    Copy 512 Bytes random data to specified disk address as a mark.
    Or to read the marks from disk for verification
    :param disk_name: disk name that be copied data to.
    :param log: an opened file object to store stdout and stderr
    :param flag: a flag to choose mark creation or verification action
    :return:
    """
    # Raw data will be restored in document mark_data, size is 512 byte
    # Contents of mark_data will be write to both front/back end of disk addresses
    commands = [
        ["dd", "if=/dev/urandom", "of=" + mark_files[0], "count=1"],
        ["dd", "if=" + mark_files[0], "of=" + disk_name, "seek=" + FRONT_SKIP, "count=1"],
        ["dd", "if=" + mark_files[0], "of=" + disk_name, "seek=" + back_skip, "count=1"],
        ["dd", "if=" + disk_name, "of=" + mark_files[1], "skip=" + FRONT_SKIP, "count=1"],
        ["dd", "if=" + disk_name, "of=" + mark_files[2], "skip=" + back_skip, "count=1"]
    ]
    if not flag:
        # Create marks
        for command in commands:
            exit_status = robust_check_call(command, log)
            assert exit_status["exit_code"] == 0, "Command [ %s ] failed" % " ".join(command)
        assert file_compare(mark_files[0], mark_files[1]), \
            "Disk front mark data is not written correctly"
        assert file_compare(mark_files[0], mark_files[2]), \
            "Disk back mark data is not written correctly"
    else:
        # Verify marks
        for command in commands[3:5]:
            exit_status = robust_check_call(command, log)
            assert exit_status["exit_code"] == 0, "Command [ %s ] failed" % " ".join(command)
        assert not file_compare(mark_files[0], mark_files[1]), \
            "Disk front mark data exists after erasing"
        assert not file_compare(mark_files[0], mark_files[2]), \
            "Disk back mark data exists after erasing"
    return


def record_timestamp(log, action):
    """
    Record erase start/complete timestamp for each disk
    :param log: secure erase log file
    :param action: secure erase start/complete string
    """
    log.write(COMMAND_LOG_MARKER + action + " erase time is:\n")
    log.write(time.strftime("%Y-%m-%d %X", time.localtime()) + "\n\n")
    log.flush()  # Align logs
    return


def secure_erase_base(disk_name, cmd):
    """
    Basic SE function
    :param disk_name: disk to be erased
    :param cmd: a list includes secure erase command argument
    :return: a dict includes SE command exitcode and SE message
    """
    name = disk_name.split("/")[-1]
    log_file = name + ".log"  # log file for sdx will be sdx.log
    log = open(log_file, "a+")

    record_timestamp(log=log, action="start")

    # Create mark on disk
    mark_files = ["_".join([name, "mark_data"]),
                  "_".join([name, "front_end"]),
                  "_".join([name, "back_end"])]
    disk_size = get_disk_size(disk_name, log, mark_files)
    back_skip = str(int(disk_size) / 512 - int(FRONT_SKIP))
    mark_on_disk(disk_name, log, False, back_skip, mark_files)  # Create marks on disk

    # Retry 3 times to run secure erase command
    # This is a workaround for hdparm/dd tool comfliction
    exit_status = {}
    for i in range(3):
        exit_status = robust_check_call(cmd=cmd, log=log)
        if exit_status["exit_code"] not in HDPARM_RETRY_EXITCODES:
            break
        time.sleep(0.5)
    if exit_status["exit_code"] == 0:
        mark_on_disk(disk_name, log, True, back_skip, mark_files)  # Verify marks on disk
    record_timestamp(log=log, action="complete")
    log.close()
    return exit_status


def hdparm_check_drive_status(pattern, disk_name, log):
    """
    Verify drive SE status use "hdparm -I /dev/sdx" command.
    :param pattern: re patten to match different SE status
    :param disk_name: disk device name
    :param log: an opened file object to store logs
    """
    command = ["hdparm", "-I", disk_name]
    exit_status = robust_check_output(cmd=command, log=log)
    assert exit_status["exit_code"] == 0, "Can't get drive %s SE or ESE status" % disk_name
    output = exit_status["message"]
    secure_index = output.find("Security")
    assert secure_index != -1, \
        "Can't find security info, probably disk %s doesn't support SE and ESE" % disk_name
    output_secure_items = output[secure_index:-1]
    assert pattern.match(output_secure_items), "Disk is not enabled for secure erase"
    return


def hdparm_secure_erase(disk_name, se_option):
    """
    Secure erase using hdparm tool
    :param disk_name: disk to be erased
    :param se_option: secure erase option
    :return: a dict includes SE command exitcode and SE message
    """
    # enhance_se = ARG_LIST.e
    log_file = disk_name.split("/")[-1] + ".log"  # log file for sdx will be sdx.log
    log = open(log_file, "a+")
    if se_option:
        hdparm_option = "--" + se_option
    else:
        hdparm_option = "--security-erase"  # Default is security erase

    # Hdparm SE Step1: check disk status
    #
    # Secure Erase supported output example
    # Security:
    #        Master password revision code = 65534
    #                supported
    #        not     enabled
    #        not     locked
    #        not     frozen
    #        not     expired: security count
    #                supported: enhanced erase
    #        2min for SECURITY ERASE UNIT. 2min for ENHANCED SECURITY ERASE UNIT.
    # Checksum: correct
    #
    # except for "supported" and "enabled", other items should have "not" before them
    if hdparm_option == "--security-erase":
        pattern_se_support = re.compile(r'[\s\S]*(?!not)[\s]*supported'
                                        r'[\s]*[\s\S]*enabled[\s]*not[\s]'
                                        r'*locked[\s]*not[\s]*frozen[\s]*not[\s]*expired[\s\S]*')
    else:
        pattern_se_support = re.compile(r'[\s\S]*(?!not)[\s]*supported[\s]*[\s\S]*enabled[\s]*not'
                                        r'[\s]*locked[\s]*not[\s]*frozen[\s]*not[\s]*expired[\s\S]*'
                                        r'supported: enhanced erase[\s\S]*')
    hdparm_check_drive_status(pattern_se_support, disk_name, log)

    # TODO: add section to unlocked a disk

    # Hdparm SE Step2: set password
    command = ["hdparm", "--verbose", "--user-master", "u",
               "--security-set-pass", SE_PASSWORD, disk_name]
    assert robust_check_call(command, log)["exit_code"] == 0, \
        "Failed to set password for disk " + disk_name

    # Hdparm SE Step3: confirm disk is ready for secure erase
    # both "supported" and "enabled" should have no "not" before them
    # other items should still  have "not" before them
    pattern_se_enabled = re.compile(r'[\s\S]*(?!not)[\s]*supported[\s]*(?!not)[\s]*enabled[\s]*not'
                                    r'[\s]*locked[\s]*not[\s]*frozen[\s]*not[\s]*expired[\s\S]*')
    hdparm_check_drive_status(pattern_se_enabled, disk_name, log)
    log.close()

    # Hdparm SE step4: run secure erase command
    command = ["hdparm", "--verbose", "--user-master", "u", hdparm_option, SE_PASSWORD, disk_name]
    return secure_erase_base(disk_name, command)


def sg_format_secure_erase(disk_name, se_option):
    """
    Secure erase using sg_format tool
    :param disk_name: disk to be erased
    :return: a dict includes SE command exitcode and SE message
    """
    if se_option:
        glist_erase_bit = "--cmplst=" + se_option
    else:
        # default Glist erasing disabled
        glist_erase_bit = "--cmplst=1"

    command = ["sg_format", "-v", "--format", glist_erase_bit, disk_name]
    return secure_erase_base(disk_name, cmd=command)


def sg_sanitize_secure_erase(disk_name, se_option):
    """
    Secure erase using sg_sanitize tool
    :param disk_name: disk to be erased
    :return: a dict includes SE command exitcode and SE message
    """
    if se_option:
        sanitize_option = "--" + se_option
    else:
        sanitize_option = "--block"  # default use block erasing
    command = ["sg_sanitize", "-v", sanitize_option, disk_name]
    return secure_erase_base(disk_name, cmd=command)


def scrub_secure_erase(disk_name, se_option):
    """
    Secure erase using scrub tool
    :param disk_name: disk to be erased
    :return: a dict includes SE command exitcode and SE message
    """
    if se_option:
        scrub_option = se_option
    else:
        scrub_option = "nnsa"  # default use nnsa standard
    command = ["scrub", "-f", "-p", scrub_option, disk_name]  # -f is to force erase
    return secure_erase_base(disk_name, cmd=command)

def delete_logs(disks):
    """
    Delete existing log file for given disks before progress monitoring start
    :param disks: disks to be erased
    :return:
    """
    for value in disks:
        value = value.split("/")[-1]
        log_file = PATH + value + ".log"
        if os.path.exists(log_file):
            os.remove(log_file)

def get_process_exit_status(async_result):
    """
    Get subprocess exit status
    :param async_result: multiprocessing Pool async result object
    :return: a dict includes process exit code and exit status description
    """
    process_result = {}
    try:
        process_exit_result = async_result.get()
    except AssertionError as err:
        process_result = {"exitcode": -1, "message": err}
    else:
        process_result["exitcode"] = process_exit_result["exit_code"]
        if process_result["exitcode"] == 0:
            process_result["message"] = "Secure erase completed successfully"
        else:
            process_result["message"] = process_exit_result["message"]
    return process_result

def progress_wrapper(obj):
    """
    Progress object wrapper, to make it picklable
    :param obj: an object of Progress
    :return:
    """
    return obj.run()

if __name__ == '__main__':
    TOOL_MAPPER = {
        "scrub": scrub_secure_erase,
        "hdparm": hdparm_secure_erase,
        "sg_format": sg_format_secure_erase,
        "sg_sanitize": sg_sanitize_secure_erase
    }
    tool = ARG_LIST.t
    option = ARG_LIST.o
    task_id = ARG_LIST.i
    server = ARG_LIST.s
    assert tool in ["scrub", "hdparm", "sg_format", "sg_sanitize"], \
        "Secure erase tool is not supported"

    # Get drive list without RAID
    disk_list = set(convert_raid_to_jbod())
    delete_logs(disk_list)
    # Get process count we should started
    # user_count = len(disk_list)
    # cpu_thread_count = cpu_count() - 1
    # if user_count > cpu_thread_count:
    #     process_count = cpu_thread_count
    # else:
    #     process_count = user_count
    process_count = cpu_count()
    pool = Pool(process_count)

    #Get secure erase progress and send notification
    progress_parser = Progress(disk_list, PATH,
                               {"taskId": task_id, "option": option,
                                "tool": tool, "address": server})
    progress_status = pool.apply_async(progress_wrapper, (progress_parser, ))
    # Run multiple processes for SE
    erase_output_list = []
    for disk in disk_list:
        erase_output = {"seMethod": tool, "disk": disk}
        result = pool.apply_async(TOOL_MAPPER[tool], args=(disk, option))
        erase_output["poolExitStatus"] = result
        erase_output_list.append(erase_output)

    progress_result = get_process_exit_status(progress_status)
    # Parse erase exit message
    # .get() is a method blocks main process
    erase_result_list = []
    for erase_output in erase_output_list:
        erase_result = {"seMethod": erase_output["seMethod"],
                        "disk": erase_output["disk"]}
        erase_result.update(get_process_exit_status(erase_output["poolExitStatus"]))
        erase_result_list.append(erase_result)

    pool.close()
    pool.join()

    if progress_result["exitcode"]:
        print progress_result["message"]

    print erase_result_list
    for erase_result in erase_result_list:
        if erase_result["exitcode"]:
            msg = "Drive %s failed to run secure erase with tool %s, error info are: \n %s" \
                  % (erase_result["disk"], erase_result["seMethod"], erase_result["message"])
            sys.exit(msg)
