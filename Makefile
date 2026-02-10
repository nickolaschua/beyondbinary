.PHONY: ralph-once ralph-afk

LOGDIR := logs
LOGFILE := $(LOGDIR)/ralph-$(shell date +%Y%m%d).log

ralph-once:
	@mkdir -p $(LOGDIR)
	RALPH_ITERATIONS=1 docker compose up --build 2>&1 | tee -a $(LOGFILE)

ralph-afk:
	@mkdir -p $(LOGDIR)
	RALPH_ITERATIONS=20 docker compose up --build 2>&1 | tee -a $(LOGFILE)
