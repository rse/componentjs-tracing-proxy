##
##  ComponentJS -- Component System for JavaScript <http://componentjs.com>
##  Copyright (c) 2009-2013 Ralf S. Engelschall <http://engelschall.com>
##
##  This Source Code Form is subject to the terms of the Mozilla Public
##  License, v. 2.0. If a copy of the MPL was not distributed with this
##  file, You can obtain one at http://mozilla.org/MPL/2.0/.
##

NPM   = npm
GRUNT = ./node_modules/grunt-cli/bin/grunt 

all: build

bootstrap:
	@if [ ! -x $(GRUNT) ]; then \
	    if [ -d node_modules ]; then \
	        $(NPM) update; \
	    else \
	        $(NPM) install; \
	    fi; \
	fi

build: bootstrap
	@$(GRUNT)

clean: bootstrap
	@$(GRUNT) clean:clean

distclean: bootstrap
	@$(GRUNT) clean:clean clean:distclean

