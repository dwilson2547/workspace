Task queues and workflows

task queues are temporary, add commands to them manually and they will be executed

workflows are persistent, tasks added will remain after running the workflow. once started, each task will be executed in order and then it will pause again when all tasks are complete. Stretch goal would be to have this run on a timer or to have a directory watcher to trigger a workflow. Additional stretch goal would be file or directory based workflows where the user selects a workflow, then a file, and executes those operations against that file. same for a directory. 

Tasks to include: 

> Task Slow and Fast modes
> Slow and fast modes are just that, slow mode should be the operation running single threaded or in some resource bound way so it doesn't hog the whole machine. this should be selected when running multiple workflows in parallel so that your tasks aren't all fighting for resources. Fast mode is when this is the only thing happening and you can really let it eat resources.

> There should also be a global config panel where users can set the default values for tasks, ie. changing the default encoding to nvidia for transcodes

> Once a queue is started it will start the next available task. when the user pauses a queue it should not interrupt the currently running task, it will simply pause at the next task once the current task is complete

> Users should have an override ability to kill tasks that they can click at any time to interrupt the process and remove the task from the queue. the task should not be removed from the queue until it is verified that the process is killed. 

* Copy
    * Single file or directory to output file or directory
* Tar
    * Multiple inputs, single output, ie. folders x y and z combined into one tarball
    * Multiple inputs, multiple outputs, ie. tar each folder in directory
    * gzip optional, enabled by default
    * check for performance improvements with multithreading, ideally there would be a slow and a fast mode
* Zip
    * Multiple inputs, single output, ie. folders x y and z combined into one tarball
    * Multiple inputs, multiple outputs, ie. tar each folder in directory
    * Have slow mode and fast mode
* Transcode
    * Single file
    * All files in directory
    * Ideally all files within parent folder regardless of depth
    * multiple encodings including for gpu
    * no slow or fast mode, use gpu to save resources
* Rsync
    * input and output directory
    * exclusion directories and pattern
* Rename
    * input file name, directory name, or pattern
    * input file location, dir location, or directory to apply pattern to
* Move
    * input file or directory
    * output location
* Delete
    * input files or directories
    * input file pattern within directory
* Download
    * url to download from
    * list of urls to download from
    * multiple spoofed usercontexts to default from
    * Allow users to provide their own contexts in global config, once context added by user it should be available in download task as option
    * Destination file location(s)
    * Proxies to run the download through
* Execute Script / Command
    * Allows the user to provide their own shell command or script to run
    * progress monitoring will be limited to none



## BUGS

2026-01-01T16:23:30.717905Z  INFO task_queue_app::tasks::transcode: Starting transcode: /mnt/x/media/TV Shows/Sherlock Series 1 - Disc 1/Sherlock Series 1 - Disc 1-EP1_t00.mkv -> /mnt/x/media/TV Shows/Sherlock Series 1 - Disc 1/Sherlock Series 1 - Disc 1-EP1_t00_transcoded.mp4 (codec: libx265, preset: medium)
2026-01-01T16:23:30.934756Z DEBUG task_queue_app::tasks::transcode: FFmpeg command: Command { std: "ffmpeg" "-i" "/mnt/x/media/TV Shows/Sherlock Series 1 - Disc 1/Sherlock Series 1 - Disc 1-EP1_t00.mkv" "-nostdin" "-c:v" "libx265" "-preset" "medium" "-crf" "23" "-s" "1920x1080" "-c:a" "aac" "-progress" "pipe:2" "-y" "/mnt/x/media/TV Shows/Sherlock Series 1 - Disc 1/Sherlock Series 1 - Disc 1-EP1_t00_transcoded.mp4", kill_on_drop: false }
2026-01-01T16:23:30.936041Z  INFO task_queue_app::tasks::transcode: Started FFmpeg process with PID: Some(159741)
2026-01-01T16:25:17.447279Z  INFO task_queue_app: Window regained focus
2026-01-01T16:25:17.555062Z DEBUG task_queue_app::commands: Getting tasks for queue: 5d884067-9539-4014-9498-5114e1e121b5
2026-01-01T16:25:34.296489Z  INFO task_queue_app: Window regained focus
pure virtual method called
terminate called without an active exception
2026-01-01T16:25:48.205287Z  INFO task_queue_app: Window regained focus
2026-01-01T16:26:00.273246Z  INFO task_queue_app: Window regained focus
2026-01-01T16:26:03.611628Z  INFO task_queue_app: Window regained focus

- Caused by adding a transcoding batch job where there were no files in the selected folder
- Structure was folderA -> folderB -> video.mkv, I selected folder A. 
- Add better logging into the application so we can actually tell what's throwing the errors
